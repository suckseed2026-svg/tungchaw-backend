import { BadRequestException, Injectable } from '@nestjs/common';
import { DashboardPeriod, DashboardQueryDto } from './dto/dashboard-query.dto';

export type DashboardDateRange = {
  period: DashboardPeriod;
  timezone: string;
  from: Date;
  to: Date;
  previousFrom: Date;
  previousTo: Date;
};

@Injectable()
export class DashboardPeriodService {
  resolve(
    query: DashboardQueryDto,
    timezone: string,
    now: Date = new Date(),
  ): DashboardDateRange {
    const period = query.period ?? DashboardPeriod.TODAY;

    if (period === DashboardPeriod.CUSTOM) {
      return this.resolveCustomRange(query, timezone);
    }

    const currentLocal = this.toLocalDate(now, timezone);

    switch (period) {
      case DashboardPeriod.TODAY:
        return this.createRange(
          period,
          timezone,
          this.startOfDay(currentLocal),
          this.addDays(this.startOfDay(currentLocal), 1),
        );

      case DashboardPeriod.YESTERDAY: {
        const to = this.startOfDay(currentLocal);
        const from = this.addDays(to, -1);

        return this.createRange(period, timezone, from, to);
      }

      case DashboardPeriod.THIS_WEEK: {
        const from = this.startOfWeek(currentLocal);
        const to = this.addDays(this.startOfDay(currentLocal), 1);

        return this.createRange(period, timezone, from, to);
      }

      case DashboardPeriod.LAST_7_DAYS: {
        const to = this.addDays(this.startOfDay(currentLocal), 1);
        const from = this.addDays(to, -7);

        return this.createRange(period, timezone, from, to);
      }

      case DashboardPeriod.THIS_MONTH: {
        const from = this.startOfMonth(currentLocal);
        const to = this.addDays(this.startOfDay(currentLocal), 1);

        return this.createRange(period, timezone, from, to);
      }

      case DashboardPeriod.LAST_30_DAYS: {
        const to = this.addDays(this.startOfDay(currentLocal), 1);
        const from = this.addDays(to, -30);

        return this.createRange(period, timezone, from, to);
      }

      case DashboardPeriod.THIS_YEAR: {
        const from = this.startOfYear(currentLocal);
        const to = this.addDays(this.startOfDay(currentLocal), 1);

        return this.createRange(period, timezone, from, to);
      }

      default:
        throw new BadRequestException('Unsupported dashboard period');
    }
  }

  private resolveCustomRange(
    query: DashboardQueryDto,
    timezone: string,
  ): DashboardDateRange {
    if (!query.fromDate || !query.toDate) {
      throw new BadRequestException(
        'fromDate and toDate are required when period is CUSTOM',
      );
    }

    const from = new Date(query.fromDate);
    const to = new Date(query.toDate);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException(
        'fromDate and toDate must be valid ISO 8601 dates',
      );
    }

    if (from >= to) {
      throw new BadRequestException('fromDate must be earlier than toDate');
    }

    return this.createRange(DashboardPeriod.CUSTOM, timezone, from, to, false);
  }

  private createRange(
    period: DashboardPeriod,
    timezone: string,
    localFrom: Date,
    localTo: Date,
    convertFromLocal = true,
  ): DashboardDateRange {
    const from = convertFromLocal
      ? this.localDateToUtc(localFrom, timezone)
      : localFrom;

    const to = convertFromLocal
      ? this.localDateToUtc(localTo, timezone)
      : localTo;

    const duration = to.getTime() - from.getTime();

    return {
      period,
      timezone,
      from,
      to,
      previousFrom: new Date(from.getTime() - duration),
      previousTo: new Date(to.getTime() - duration),
    };
  }

  private toLocalDate(date: Date, timezone: string): Date {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);

    const values = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
    );

    return new Date(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second),
      0,
    );
  }

  private localDateToUtc(localDate: Date, timezone: string): Date {
    const utcGuess = new Date(
      Date.UTC(
        localDate.getFullYear(),
        localDate.getMonth(),
        localDate.getDate(),
        localDate.getHours(),
        localDate.getMinutes(),
        localDate.getSeconds(),
        localDate.getMilliseconds(),
      ),
    );

    const timezoneDate = this.toLocalDate(utcGuess, timezone);
    const offset =
      utcGuess.getTime() -
      new Date(
        Date.UTC(
          timezoneDate.getFullYear(),
          timezoneDate.getMonth(),
          timezoneDate.getDate(),
          timezoneDate.getHours(),
          timezoneDate.getMinutes(),
          timezoneDate.getSeconds(),
          timezoneDate.getMilliseconds(),
        ),
      ).getTime();

    return new Date(utcGuess.getTime() + offset);
  }

  private startOfDay(date: Date): Date {
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      0,
      0,
      0,
      0,
    );
  }

  private startOfWeek(date: Date): Date {
    const day = date.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;

    return this.addDays(this.startOfDay(date), mondayOffset);
  }

  private startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  }

  private startOfYear(date: Date): Date {
    return new Date(date.getFullYear(), 0, 1, 0, 0, 0, 0);
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);

    return result;
  }
}
