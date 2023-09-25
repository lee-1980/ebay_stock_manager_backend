export const timeConverter = (time) => {
    const timeArray = time.split(':');
    const hour = timeArray[0];
    const minute = timeArray[1];
    const second = timeArray[2];
    return `${second} ${minute} ${hour} * * *`;
}