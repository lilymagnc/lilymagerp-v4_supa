"use client";

import React from 'react';

/**
 * SyncBridgeProvider
 * 
 * (Disabled) Previously provided real-time Firebase-to-Supabase synchronization.
 * Manual synchronization is now preferred via the Settings page.
 */
export function SyncBridgeProvider({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
