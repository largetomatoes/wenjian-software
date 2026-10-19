'use client';
import {memo,type ComponentProps} from 'react';
import {QuestionMap} from './question-map';
// Keep camera and navigation state, but stop invisible graph layout while reading.
export const ReadingBackgroundMap=memo(function Background({paused,...props}:ComponentProps<typeof QuestionMap>&{paused:boolean}){
 return <QuestionMap {...props}/>;
},(previous,next)=>next.paused&&previous.viewKey===next.viewKey);
