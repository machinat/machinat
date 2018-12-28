// @flow
/* eslint-disable import/prefer-default-export */
import type { FailedJobBatchResponse } from 'machinat-queue/types';

export class SendError<Job, Result> extends Error {
  response: FailedJobBatchResponse<Job, Result>;

  constructor(response: FailedJobBatchResponse<Job, Result>) {
    const { errors } = response;

    const message = errors
      ? errors.reduce(
          (msg, err) => `${msg}\n\n\t${err.stack || err.toString()}`,
          'Errors happen while sending:'
        )
      : 'Unknown error happen while sending';

    super(message);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SendError);
    }

    this.response = response;
  }
}
