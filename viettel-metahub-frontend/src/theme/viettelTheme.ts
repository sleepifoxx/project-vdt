export const viettelColors = {
    primary: '#EE0033',
    primaryDark: '#CC0029',
    primaryDarker: '#AA0022',
    primaryLight: '#FFF0F3',
    primaryLighter: '#FFF5F7',

    white: '#FFFFFF',
    black: '#000000',

    gray50: '#FAFAFA',
    gray100: '#F5F5F5',
    gray200: '#EEEEEE',
    gray300: '#E0E0E0',
    gray400: '#BDBDBD',
    gray500: '#9E9E9E',
    gray600: '#757575',
    gray700: '#616161',
    gray800: '#424242',
    gray900: '#212121',

    success: '#52C41A',
    successLight: '#F6FFED',
    warning: '#FAAD14',
    warningLight: '#FFFBE6',
    error: '#FF4D4F',
    errorLight: '#FFF2F0',
    info: '#1677FF',
    infoLight: '#E6F4FF',
};

export const viettelTheme = {
    token: {
        colorPrimary: viettelColors.primary,
        colorPrimaryHover: viettelColors.primaryDark,
        colorPrimaryActive: viettelColors.primaryDarker,
        colorPrimaryBg: viettelColors.primaryLight,
        colorPrimaryBgHover: viettelColors.primaryLighter,
        colorLink: viettelColors.primary,
        colorLinkHover: viettelColors.primaryDark,
        borderRadius: 6,
        fontFamily: "'Be Vietnam Pro', 'Roboto', 'Segoe UI', sans-serif",
        colorBgContainer: viettelColors.white,
        colorBgLayout: viettelColors.gray100,
    },
    components: {
        Button: {
            colorPrimary: viettelColors.primary,
            colorPrimaryHover: viettelColors.primaryDark,
            colorPrimaryActive: viettelColors.primaryDarker,
        },
        Menu: {
            colorItemBgSelected: viettelColors.primaryLight,
            colorItemTextSelected: viettelColors.primary,
            colorItemBgHover: viettelColors.primaryLighter,
        },
        Table: {
            colorFillAlter: viettelColors.gray50,
        },
        Tag: {
            colorPrimary: viettelColors.primary,
        },
    },
};
