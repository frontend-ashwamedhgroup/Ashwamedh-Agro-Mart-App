
const IS_DEV = process.env.APP_VARIANT === 'development';
const IS_PREVIEW = process.env.APP_VARIANT === 'preview';

const getUniqueIdentifier = () => {
    if (IS_DEV) {
        return 'com.ashwamedhagromart.dev';
    }

    if (IS_PREVIEW) {
        return 'com.ashwamedhagromart.preview';
    }

    return 'com.ashwamedhagromart';
};

const getAppName = () => {
    if (IS_DEV) {
        return 'Ashwamedh Agro Mart (Dev)';
    }

    if (IS_PREVIEW) {
        return 'Ashwamedh Agro Mart (Preview)';
    }

    return 'Ashwamedh Agro Mart';
};


export default ({ config }) => ({
    ...config,
    name: getAppName(),
    ios: {
        ...config.ios,
        bundleIdentifier: getUniqueIdentifier(),
    },
    android: {
        ...config.android,
        package: getUniqueIdentifier(),
    },
});

