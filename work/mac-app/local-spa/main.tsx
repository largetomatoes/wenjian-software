import React from 'react';
import {installReaderBudget} from '../../../lib/windows-reader-performance';
import {installReaderWorkScheduling} from '../../../lib/reader-work';
import {installWindowsCloseProtocol} from '../../../lib/windows-close';
import { createRoot } from 'react-dom/client';
import Home from '../../../app/page';
import {PluginChangeReview} from '../../../components/plugin-change-review';
import {UniversalDeleteProvider} from '../../../components/universal-delete';
import '../../../app/globals.css';
import '../../../components/desktop-polish.css';

// Only Windows bundles these fonts. Mac keeps PingFang / Songti from macOS.
document.documentElement.dataset.wenjianOptimized='true';document.documentElement.dataset.wenjianPlugins='true';
if(!navigator.userAgent.includes('Windows'))document.documentElement.dataset.wenjianPlatform='mac';
installReaderWorkScheduling();installReaderBudget();installWindowsCloseProtocol();
if(navigator.userAgent.includes('Windows')){installWindowsCloseProtocol();document.documentElement.dataset.wenjianPlatform='windows';installReaderWorkScheduling();installReaderBudget();if(!document.querySelector('link[href="/fonts/windows-fonts.css"]')){const link=document.createElement('link');link.rel='stylesheet';link.href='/fonts/windows-fonts.css';document.head.appendChild(link);}}

createRoot(document.getElementById('root')!).render(<React.StrictMode><UniversalDeleteProvider><Home /><PluginChangeReview/></UniversalDeleteProvider></React.StrictMode>);
