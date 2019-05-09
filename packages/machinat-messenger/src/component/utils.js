import {
  asNative,
  asNamespace,
  annotate,
  wrapSinglePartSegment,
  wrapSingleUnitSegment,
} from 'machinat-renderer';
import { compose } from 'machinat-utility';

import {
  MESSENGER_NAITVE_TYPE,
  MESSENGER_NAMESPACE,
  ENTRY_MESSAGES,
} from '../constant';

export const asContainerComponent = compose(
  asNative(MESSENGER_NAITVE_TYPE),
  asNamespace(MESSENGER_NAMESPACE)
);

export const asSinglePartComponent = compose(
  asNative(MESSENGER_NAITVE_TYPE),
  asNamespace(MESSENGER_NAMESPACE),
  wrapSinglePartSegment
);

export const asSingleUnitComponentWithEntry = entry =>
  compose(
    asNative(MESSENGER_NAITVE_TYPE),
    asNamespace(MESSENGER_NAMESPACE),
    annotate('$$entry', entry),
    wrapSingleUnitSegment
  );

export const asSingleMessageUnitComponent = asSingleUnitComponentWithEntry(ENTRY_MESSAGES);

export const mapSegmentValue = mapper => segments => {
  if (segments === null) {
    return null;
  }

  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    segment.value = mapper(segment.value);
  }

  return segments;
};
