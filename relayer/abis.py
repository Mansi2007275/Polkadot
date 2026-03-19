SUBSIDY_POOL_ABI = [
    {
        "name": "subsidisedWithdraw",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "streamId", "type": "uint256"},
            {"name": "amount", "type": "uint256"},
        ],
        "outputs": [],
    },
    {
        "name": "totalGasCovered",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"name": "", "type": "uint256"}],
    },
    {
        "name": "totalSubsidisedTxns",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"name": "", "type": "uint256"}],
    },
    {
        "name": "authorisedRelayers",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "", "type": "address"}],
        "outputs": [{"name": "", "type": "bool"}],
    },
    {
        "name": "poolBalance",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"name": "", "type": "uint256"}],
    },
]

STREAM_ABI = [
    {
        "name": "balanceOf",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "streamId", "type": "uint256"}],
        "outputs": [{"name": "balance", "type": "uint256"}],
    },
    {
        "name": "getStream",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "streamId", "type": "uint256"}],
        "outputs": [
            {
                "name": "",
                "type": "tuple",
                "components": [
                    {"name": "sender", "type": "address"},
                    {"name": "recipient", "type": "address"},
                    {"name": "token", "type": "address"},
                    {"name": "deposit", "type": "uint256"},
                    {"name": "ratePerSecond", "type": "uint256"},
                    {"name": "startTime", "type": "uint256"},
                    {"name": "stopTime", "type": "uint256"},
                    {"name": "withdrawn", "type": "uint256"},
                    {"name": "status", "type": "uint8"},
                ],
            }
        ],
    },
    {
        "name": "nextStreamId",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"name": "", "type": "uint256"}],
    },
    {
        "name": "StreamCreated",
        "type": "event",
        "inputs": [
            {"name": "streamId", "type": "uint256", "indexed": True},
            {"name": "sender", "type": "address", "indexed": True},
            {"name": "recipient", "type": "address", "indexed": True},
            {"name": "token", "type": "address", "indexed": False},
            {"name": "deposit", "type": "uint256", "indexed": False},
            {"name": "startTime", "type": "uint256", "indexed": False},
            {"name": "stopTime", "type": "uint256", "indexed": False},
            {"name": "ratePerSecond", "type": "uint256", "indexed": False},
        ],
    },
    {
        "name": "StreamWithdrawn",
        "type": "event",
        "inputs": [
            {"name": "streamId", "type": "uint256", "indexed": True},
            {"name": "recipient", "type": "address", "indexed": True},
            {"name": "amount", "type": "uint256", "indexed": False},
            {"name": "gasSubsidised", "type": "bool", "indexed": False},
        ],
    },
]

BRIDGE_ABI = [
    {
        "name": "syncRealTimeYield",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [],
        "outputs": [],
    },
    {
        "name": "getStakingStats",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [
            {"name": "pendingRewards_", "type": "uint256"},
            {"name": "stakedAmount_", "type": "uint256"},
            {"name": "totalSwept_", "type": "uint256"},
            {"name": "lastSync_", "type": "uint256"},
        ],
    },
    {
        "name": "lastYieldSync",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"name": "", "type": "uint256"}],
    },
]
