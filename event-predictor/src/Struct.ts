export interface EventRanking {
    id: number;
    eventId: number;
    timestamp: Date;
    rank: number;
    score: number;
    userId: any;
    userName: string;
}

export interface Data {
    eventRankings: EventRanking[];
}

export interface EventData {
    status: string;
    data: Data;
    message?: any;
}

export interface SimpleRanking {
    time: Date,
    pt: number
}

export interface OutRanking {
    beginTime: Date;
    lastTime: Date;
    lastScore: number;
    dayScores: number[];
    halfHourScores: number[];
}