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
    if (!value) {
      this.logger.warn('No date value provided, returning null');
      return null; // or throw an error if required
    }
    const date = Date.parse(value);
    //this.logger.debug(new Date(value));

    if (date && isNaN(date))
      throw new HttpException('Invalid date string', HttpStatus.BAD_REQUEST);

    return new Date(value);
    // return value
  }
}
