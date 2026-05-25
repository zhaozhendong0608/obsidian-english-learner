/**
 * 二分查找状态接口
 */
export interface BinarySearchState {
    low: number;
    high: number;
    round: number;
}

/**
 * 获取当前二分搜索的中点索引
 */
export function getNextBinarySearchIndex(state: BinarySearchState): number {
    return Math.floor((state.low + state.high) / 2);
}

/**
 * 根据用户是否认识当前单词，更新二分区间和轮数
 * @param state 当前二分搜索状态
 * @param known 用户是否认识
 */
export function updateBinarySearch(state: BinarySearchState, known: boolean): BinarySearchState {
    const mid = getNextBinarySearchIndex(state);
    const nextState = { ...state, round: state.round + 1 };
    if (known) {
        // 认识 -> 向高处检索
        nextState.low = mid + 1;
    } else {
        // 不认识 -> 向低处检索
        nextState.high = mid - 1;
    }
    return nextState;
}
