import { StyleSheet, View, TouchableOpacity, Text, Pressable } from 'react-native';
import { CameraView, CameraType, useCameraPermissions, CameraMode } from 'expo-camera';
import { useCameraPermission, useCameraDevice, Camera } from 'react-native-vision-camera';
import { Image } from 'expo-image';
import { useState, useRef } from 'react';
import { loadTensorflowModel, useTensorflowModel } from 'react-native-fast-tflite';
import * as ImageManipulator from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import { decode as decodeJpeg } from 'jpeg-js';


export function Scanner() {
    const [facing, setFacing] = useState<'front' | 'back'>('back');
    const device = useCameraDevice(facing);
    const { hasPermission, requestPermission } = useCameraPermission();
    const camera = useRef<Camera>(null);
    const [photoUri, setPhotoUri] = useState<string | null>(null);
    const [ready, setReady] = useState<boolean>(false);
    const plugin = useTensorflowModel(require('model.tflite'));
    const model = plugin.state === 'loaded' ? plugin.model : undefined


    if (!hasPermission) {
        // eventually replace this with an automatic screen, later move
        return (
            <View style={styles.permissionsPage}>
                <Text>Please grant permission for camera access.</Text>
                <Pressable onPress={requestPermission}>Grant Camera Access.</Pressable> 
            </View>
        )
    }

    if (device == null) {
        return <View />
    }

    
    function toggleCameraDirection() {
        setFacing(current => (current === 'back' ? 'front' : 'back'));
    }

    // manual function for base64 (NO LIBRARIES WORKING !!!)
    /*
    function base64ToBytes(base64: string): Uint8Array {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
        let str = base64.replace(/[\r\n=]/g, '');
        let bytes = [];
        for (let i = 0; i < str.length; i += 4) {
            const c1 = chars.indexOf(str[i]);
            const c2 = chars.indexOf(str[i + 1]);
            const c3 = chars.indexOf(str[i + 2]);
            const c4 = chars.indexOf(str[i + 3]);
            const b1 = (c1 << 2) | (c2 >> 4);
            const b2 = ((c2 & 15) << 4) | (c3 >> 2);
            const b3 = ((c3 & 3) << 6) | c4;
            bytes.push(b1);
            if (c3 !== 64 && str[i + 2] !== '=') bytes.push(b2);
            if (c4 !== 64 && str[i + 3] !== '=') bytes.push(b3);
        }
        return new Uint8Array(bytes);
    }
    
    */
    
    const takePicture = async () => {
        if (!ready || !camera.current) return;

        try {
            console.log("Click")
            const photo = await camera.current.takePhoto();
            setPhotoUri(`file://${photo.path}`);

        } catch (e) {
            console.warn("Capture failed!", e);
        }
    }

    const uploadPhoto = async (uri: string) => {
        // post request to backend server
        console.log("Button Clicked!");

        if (!model) {
            console.warn("Model wasn't loaded!");
            return;
        }


        try {
            const result = await ImageManipulator.manipulateAsync(
                uri,
                [{ resize: { width: 224, height: 224 } }],
                { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
            );
            console.log("Resized img!", result.uri)

            const file = new File(result.uri);
            const bytes = await file.bytes();

            const { data, width, height } = decodeJpeg(bytes, { useTArray: true });

            const input = new Float32Array(width * height * 3);
            for (let i = 0, j = 0; i < input.length; i += 3, j += 4) {
                const r = data[j];
                const g = data[j + 1];
                const b = data[j + 2];
                input[i]     = r;     // 0..255
                input[i + 1] = g;     // 0..255
                input[i + 2] = b;     // 0..255
            }

            const inputTensor = new Float32Array(1 * 224 * 224 * 3);
            inputTensor.set(input);

            const outputs = model.runSync
            ? model.runSync([inputTensor])
            : model.run([inputTensor]);

            const probs = outputs[0] as Float32Array;
            let bestIdx = 0, best = -Infinity;
            for (let k = 0; k < probs.length; k++) if (probs[k] > best) { best = probs[k]; bestIdx = k; }
            console.log(`Pred: ${bestIdx}  conf: ${(best*100).toFixed(2)}%`);

        } catch (e) {
            console.warn("Image manipulation failed:", e);
        }


        

    }


    const renderPicture = (uri: string) => {
        return (
            <View style={styles.previewContainer}>
                <Image source={{uri}} style={styles.previewImage} contentFit='contain'/>
                <View style={styles.buttonContainer}>
                    <TouchableOpacity style={styles.button} onPress={() => setPhotoUri(null)}>
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
                <Camera 
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={true}
                ref={camera}
                photo={true}
                onInitialized={() => setReady(true)}
                />
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

        /*
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
        */
    }

    return (
       <View style={styles.biggerContainer}>
        {photoUri ? renderPicture(photoUri): renderCamera() }
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
