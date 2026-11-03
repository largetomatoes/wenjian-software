import type {Manuscript} from './notebook';
import {sameJson} from './stable-json.cjs';
/** A loaded editor owns its original version, not the latest incoming props. */
export function manuscriptVersionMatches(base:Manuscript|null,current:Manuscript|undefined){return !!base&&!!current&&sameJson(base,current);}
