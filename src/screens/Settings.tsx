import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function Settings() {
    const insets = useSafeAreaInsets();

    return (
        <View
            style={{
                flex: 1,
                paddingTop: insets.top,
            }}
            className="bg-white dark:bg-black"
        >
            <View className="w-full px-5 mt-4 mb-2">
                <Text className="text-gray-900 dark:text-white text-5xl mt-2 font-extrabold">Settings</Text>
            </View>

        </View>
    )
}