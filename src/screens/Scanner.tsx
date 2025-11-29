import { StyleSheet, View, TouchableOpacity, Text, Pressable, StatusBar, useWindowDimensions } from 'react-native';
import { useCameraPermission, useCameraDevice, Camera } from 'react-native-vision-camera';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'; 
import { runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useTensorflowModel } from '../providers/ModelProvider';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
// Local alias for TypedArray since the library doesn't export a type
type TypedArray =
  | Float32Array
  | Int32Array
  | Uint8Array
  | Uint8ClampedArray
  | Int8Array
  | Uint16Array
  | Int16Array
  | Uint32Array;
import * as ImageManipulator from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import { decode as decodeJpeg } from 'jpeg-js';


type Point = {
    x: number;
    y: number;
};


export function Scanner() {
    //const [facing, setFacing] = useState<'front' | 'back'>('back');
    const device = useCameraDevice('back', {
        physicalDevices: [
            'ultra-wide-angle-camera',
            'wide-angle-camera',
            'telephoto-camera'
        ]
    });
    const { hasPermission, requestPermission } = useCameraPermission();
    const camera = useRef<Camera>(null);
    const [photoUri, setPhotoUri] = useState<string | null>(null);
    const [photoSize, setPhotoSize] = useState<{ width: number; height: number} | null>(null);
    const [ready, setReady] = useState<boolean>(false);
    const { model, status, error } = useTensorflowModel();
    const insets = useSafeAreaInsets();
    const focusDot = useRef<{x: Number, y: number} | null>(null);
    const [showFocusDot, setShowFocusDot] = useState(false);

    // Ask for camera permission on first load
    useEffect(() => {
        if (!hasPermission) {
            requestPermission();
        }
    }, [hasPermission, requestPermission]);

    const focus = useCallback((point: Point) => {
        const c = camera.current;
        if (c == null) return;
        c.focus(point);
    }, [])

    const gesture = Gesture.Tap().onEnd(({x, y}) => {
        runOnJS(focus)({x, y});
    })


    if (status === 'loading') {
        return <View><Text>Model Loading ...</Text></View>;
    }
    if (status === 'error') {
        return <View><Text>Error loading model ... {error?.message}</Text></View>;
    }
    if (!model) {
        return <View><Text>Model not loaded yet ...</Text></View>;
    }

    if (!hasPermission) {
        // eventually replace this with an automatic screen, later move
        return (
            <View style={styles.permissionsPage}>
                <Text>Please grant permission for camera access.</Text>
                <Pressable onPress={requestPermission} style={styles.permissionsButton}>
                    <Text style={styles.permissionsButtonText}>Grant Camera Access</Text>
                </Pressable> 
            </View>
        )
    }

    if (device == null) {
        return <View />
    }

    
    /*
    function toggleCameraDirection() {
        setFacing(current => (current === 'back' ? 'front' : 'back'));
    }

    */

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
            setPhotoSize({ width: photo.width, height: photo.height });
        } catch (e) {
            console.warn("Capture failed!", e);
        }
    }

    // Keep hooks before any conditional return to avoid hook order changes

    const uploadPhoto = async (uri: string) => {
        // post request to backend server
        console.log("Button Clicked!");

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

            let outputs: TypedArray[];
            if (typeof (model as any).runSync === 'function') {
                outputs = (model as any).runSync([inputTensor]) as TypedArray[];
            } else {
                outputs = await (model as any).run([inputTensor]);
            }

            const probs = outputs[0] as Float32Array;
            let bestIdx = 0, best = -Infinity;
            for (let k = 0; k < probs.length; k++) if (probs[k] > best) { best = probs[k]; bestIdx = k; }
            const predArray = ['aerobic_steppers', 'bench_press', 'dumb_bell', 'elliptical', 'multi_machine', 'rowing_machine', 'treadmill'];
            console.log(`Pred: ${predArray[bestIdx]}  conf: ${(best*100).toFixed(2)}%`);

        } catch (e) {
            console.warn("Image manipulation failed:", e);
        }
    }


    const renderPicture = (uri: string) => {
        return (
            <View style={styles.previewContainer}>
                <RenderStatusBar />
                <Image 
                    source={{uri}} 
                    style={StyleSheet.absoluteFill} 
                    contentFit='cover'
                />

                <Pressable
                onPress={() => setPhotoUri(null)}
                style={{
                    position: 'absolute',
                    top: insets.top + 8,
                    left: 12,
                    width: 44,
                    height: 44,
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
                >
                    <Text style={{ fontSize: 34, color: 'white' }}>×</Text>
                </Pressable>

                <CaptureButton 
                mode="preview"
                onConfirm={() => uploadPhoto(uri)}
                insetsBottom={insets.bottom}
                />
            </View>
        );
    };

    function RenderStatusBar() {
        return (
            <>
                <View 
                pointerEvents = "none"
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: insets.top,
                    backgroundColor: 'black',
                    zIndex: 1000
                }}
                />
                <StatusBar 
                barStyle='light-content'
                hidden={false}
                />
            </>
        )
    }


    function CaptureButton({
        mode,
        onCapture,
        onConfirm,
        insetsBottom = 0,
    }: {
        mode: 'idle' | 'preview';
        onCapture?: () => void;
        onConfirm?: () => void;
        insetsBottom?: number;
    }) {
        const scale = useSharedValue(1);

        const style = useAnimatedStyle(() => ({
            transform: [{scale: scale.value}],
        }));

        const pressIn = () => {
            // Snappier press-in animation
            scale.value = withTiming(0.9, {
                duration: 80,
                easing: Easing.out(Easing.quad),
            });
        };
        const pressOut = () => {
            // Quick release back to normal
            scale.value = withTiming(1, {
                duration: 100,
                easing: Easing.out(Easing.quad),
            });
        };
        const handlePress = () => {
            if (mode === 'idle') onCapture?.();
            else onConfirm?.();
        };

        return (
            <Animated.View 
            style = {[
                {
                    position: 'absolute',
                    bottom: Math.max(insetsBottom, 12) + 8,
                    alignSelf: 'center',
                },
                style,
            ]}
            >
                <Pressable
                    onPressIn={pressIn}
                    onPressOut={pressOut}
                    onPress={handlePress}
                    style={{
                        width: 72,
                        height: 72,
                        borderRadius: 36,
                        backgroundColor: 'white',
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}
                >
                    {mode === 'idle' ? (
                        <View
                        style={{
                            width: 60,
                            height: 60,
                            borderRadius: 30,
                            backgroundColor: 'white',
                        }}
                        />
                    ) : (
                        <Text style={{fontSize: 28, fontWeight: 'bold', color: 'black'}}>✓</Text>
                    )}
                </Pressable>
            </Animated.View>
        );
    }


    const renderCamera = () => {
        return (
            <GestureHandlerRootView>
            <View style={styles.container}>
                <RenderStatusBar />
                    <GestureDetector gesture={gesture}>
                        <Camera 
                        style={StyleSheet.absoluteFill}
                        device={device}
                        isActive={true}
                        ref={camera}
                        photo={true}
                        enableZoomGesture={true}
                        zoom={device.neutralZoom}
                        outputOrientation="preview"
                        onInitialized={() => setReady(true)}
                        />
                    </GestureDetector>
                {/*
                <View style={styles.buttonContainer}>
                    <TouchableOpacity style={styles.button} onPress={takePicture}>
                        <Text style={styles.text}>Take Photo</Text>
                    </TouchableOpacity>
                </View>
                */}

                <CaptureButton 
                mode="idle"
                onCapture={takePicture}
                insetsBottom={insets.bottom}
                />

            </View>

            </GestureHandlerRootView>
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
    backgroundColor: 'black',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  permissionsButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: 'white',
  },
  permissionsButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'black',
  },
});
