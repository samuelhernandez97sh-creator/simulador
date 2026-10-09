const { amount, bank } = req.query;



const response = await fetch('https://p2p.binance.com/bapi/c2c/v1/friendly/c2c/adv/search', {

    method: 'POST',

    headers: {

        'Content-Type': 'application/json',

        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

    },

    body: JSON.stringify({

        "asset": "USDT",

        "fiat": "VES",

        "merchantCheck": false,

        "page": 1,

        "rows": 5,

        "tradeType": "SELL",

        "transAmount": amount ? String(amount) : "",

        "payTypes": [bank ? bank : "BancoDeVenezuela"] // Dinámico según el parámetro

    })

});
