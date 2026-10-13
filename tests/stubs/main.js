export const panel = {
    statusArea: {
        quickSettings: {
            indicators: [],
            addExternalIndicator(indicator) {
                this.indicators.push(indicator);
            },
        },
    },
};
