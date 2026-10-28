const { expo } = require('./app.json');

module.exports = () => {
  const configuredBaseUrl = process.env.EXPO_PUBLIC_BASE_URL;
  return {
    expo: {
      ...expo,
      experiments: {
        ...expo.experiments,
        ...(configuredBaseUrl ? { baseUrl: configuredBaseUrl } : {}),
      },
    },
  };
};
