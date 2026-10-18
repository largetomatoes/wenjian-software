import React from 'react';
import {installReaderWorkScheduling} from '../../../lib/reader-work';
import {installWindowsCloseProtocol} from '../../../lib/windows-close';
import { createRoot } from 'react-dom/client';
import Home from '../../../app/page';
import '../../../app/globals.css';
import '../../../components/desktop-polish.css';

// Only Windows bundles these fonts. Mac keeps PingFang / Songti from macOS.
if(navigator.userAgent.includes('Windows')){installWindowsCloseProtocol();document.documentElement.dataset.wenjianPlatform='windows';installReaderWorkScheduling();if(!document.querySelector('link[href="/fonts/windows-fonts.css"]')){const link=document.createElement('link');link.rel='stylesheet';link.href='/fonts/windows-fonts.css';document.head.appendChild(link);}}

createRoot(document.getElementById('root')!).render(<React.StrictMode><Home /></React.StrictMode>);
