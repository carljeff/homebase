import type { Metadata } from "next";
import "./globals.css";
export const metadata:Metadata={title:"Homebase · A little more together",description:"Your private family space for meals, projects and everyday life.",manifest:"/manifest.webmanifest",icons:{icon:"/favicon.svg"},appleWebApp:{capable:true,title:"Homebase",statusBarStyle:"default"}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
