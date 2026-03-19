import { useBlockNumber } from "wagmi";

export function useLiveBlockNumber() {
  const { data: blockNumber } = useBlockNumber({
    watch: true,
  });
  return blockNumber;
}
