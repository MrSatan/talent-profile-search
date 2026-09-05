import { HttpStatus } from '@nestjs/common';
import { ApplicationException } from '../common/application.exception';

export class SearchUnavailableException extends ApplicationException {
  constructor() {
    super(
      HttpStatus.SERVICE_UNAVAILABLE,
      'SEARCH_UNAVAILABLE',
      'Profile search is temporarily unavailable.',
    );
  }
}
