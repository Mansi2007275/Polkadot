from config import Config
print(f"PRIVATE_KEY: {'[SET]' if Config.PRIVATE_KEY else '[EMPTY]'}")
print(f"SUBSIDY_POOL_ADDRESS: {Config.SUBSIDY_POOL_ADDRESS}")
print(f"STREAM_ADDRESS: {Config.STREAM_ADDRESS}")
print(f"BRIDGE_ADDRESS: {Config.BRIDGE_ADDRESS}")
