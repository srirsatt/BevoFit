module.exports = ({ config }) => {
  const googleMapsApiKey = process.env.ANDROID_GOOGLE_MAPS_API_KEY?.trim();

  return {
    ...config,
    android: {
      ...config.android,
      ...(googleMapsApiKey && {
        config: {
          ...config.android?.config,
          googleMaps: { apiKey: googleMapsApiKey },
        },
      }),
    },
  };
};
