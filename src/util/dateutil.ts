
interface DateParts {
    year: string;
    month: string;
    day: string;
}

export default class DateUtil {
    static readonly UNKNOWN_DATE: string = "Unknown";
    static readonly UNKNOWN_DAY: string = "Unknown Day";

    static extractDateParts(ctime: string | null): DateParts {
        if (!ctime) return { year: this.UNKNOWN_DATE, month: this.UNKNOWN_DATE, day: this.UNKNOWN_DAY };
        return {
            year: ctime.substring(0, 4),
            month: ctime.substring(0, 7),
            day: ctime.substring(0, 10)
        };
    }
}