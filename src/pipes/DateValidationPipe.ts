import {
  ArgumentMetadata,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  PipeTransform,
} from '@nestjs/common';

@Injectable()
export class DateValidationPipe implements PipeTransform {
  readonly logger = new Logger(DateValidationPipe.name);

  transform(value: any, metadata: ArgumentMetadata) {
    const date = Date.parse(value);
    this.logger.debug(new Date(value));

    if (isNaN(date))
      throw new HttpException('Invalid date string', HttpStatus.BAD_REQUEST);

    return new Date(value);
    // return value
  }
}
