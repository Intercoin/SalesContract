
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
        case 137: //Polygon MainNet
            return {
                usdt: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
                weth: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270" // wbnb in this case
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