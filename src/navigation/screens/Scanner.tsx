import { Button, Text } from '@react-navigation/elements';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { CameraView, CameraType, useCameraPermissions, Camera, CameraMode } from 'expo-camera';
import { Image } from 'expo-image';
import { useState, useRef } from 'react';

export function Scanner() {
    const [facing, setFacing] = useState<CameraType>('back');
    const [permission, requestPermission] = useCameraPermissions();
    const ref = useRef<CameraView>(null);
    const [uri, setUri] = useState<string | null>(null);
    const [ready, setReady] = useState<boolean>(false);

    if (!permission) {
        return <View /> // blank view
    }

    if (!permission.granted) {
        // eventually replace this with an automatic screen, later move
        return (
            <View style={styles.permissionsPage}>
                <Text>Please grant permission for camera access.</Text>
                <Button onPress={requestPermission}>Grant Camera Access.</Button> 
            </View>
        )
    }

    function toggleCameraDirection() {
        setFacing(current => (current === 'back' ? 'front' : 'back'));
    }
    
    const takePicture = async () => {
        if (!ready || !ref.current) return;

        try { 
            const photo = await ref.current?.takePictureAsync({
                quality: 0.5,
                skipProcessing: true,
            });
            if (photo?.uri) setUri(photo.uri);
        } catch (e) {
            console.warn("pic capture failed: ", e);
        }
    }

    const uploadPhoto = async (uri: string) => {
        // post request to backend server
        console.log("Button Clicked!");

        const formData = new FormData();
        formData.append("file", {
            uri,
            name: 'photo.jpg',
            type: 'image/jpeg',
        } as any );

        try {
            const res = await fetch('https://b54afe7e6073.ngrok-free.app/classify', {
                method: "POST",
                body: formData,
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            });

            const result = await res.json();
            console.log("server response: ", result);

        } catch (err) {
            console.error("thing errored", err);
        }
    }


    const renderPicture = (uri: string) => {
        return (
            <View style={styles.previewContainer}>
                <Image source={{uri}} style={styles.previewImage} contentFit='contain'/>
                <View style={styles.buttonContainer}>
                    <TouchableOpacity style={styles.button} onPress={() => setUri(null)}>
                        <Text style={styles.text}>Take Another Picture?</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.button} onPress={() => uploadPhoto(uri)}>
                        <Text style={styles.text}>Upload Photo?</Text>
                    </TouchableOpacity>
                </View>
            </View>
        )
    }

    const renderCamera = () => {
        return (
            <View style={styles.container}>
            <CameraView style={styles.camera} facing={facing} ref={ref} onCameraReady={() => setReady(true)} mode="picture"/>
            <View style={styles.buttonContainer}>
                <TouchableOpacity style={styles.button} onPress={toggleCameraDirection}>
                    <Text style={styles.text}>Flip Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.button} onPress={takePicture}>
                    <Text style={styles.text}>Take Photo</Text>
                </TouchableOpacity>
            </View>
        </View>
        )
    }

    return (
       <View style={styles.biggerContainer}>
        {uri ? renderPicture(uri): renderCamera() }
       </View>
    )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  biggerContainer: {
    flex: 1,
    backgroundColor: '#000'
  },
  permissionsPage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  camera: {
    flex: 1,
    width: '100%',
    height: '100%'
  }, 
  buttonContainer: {
    position: 'absolute',
    bottom: 64,
    flexDirection: 'column',
    backgroundColor: 'transparent',
    width: '100%',
    paddingHorizontal: 64,
  },
  button: {
    flex: 1,
    alignItems: 'center',
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: 'black'
  },
  previewImage: {
    width: '100%',
    height: '100%',
  }
});
