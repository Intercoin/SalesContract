
function getStableCoinsList(chainId) {
    if (typeof chainId == 'string') {
        if (chainId.match(/^0x/)) {
            chainId = Number(chainId);
        } else {
            throw "unsupported chain format = '"+chainId+"'";
        }
    };
    
    switch (chainId) {
        case 56: //binance smartchain
            return {
                usdt: "0x55d398326f99059fF775485246999027B3197955",
                weth: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c" // wbnb in this case
            }
            break;
        case 'Papayas':
        default:
            throw "unsupported chain= '"+chainId+"'";
            // return {
            //     usdt: false, //constants.ZERO_ADDRESS
            //     weth: false //constants.ZERO_ADDRESS
            // }
    }
}

module.exports = {
    getStableCoinsList
}