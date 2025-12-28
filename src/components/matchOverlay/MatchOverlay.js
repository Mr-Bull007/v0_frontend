'use client'

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import stl from './MatchOverlay.module.scss';
import { apiCall } from '@/store/utils';
import { endpoints } from '@/store/urls';
import { io } from 'socket.io-client';

const MatchOverlay = ({ matchId, tournamentId }) => {
    const [scoreData, setScoreData] = useState(null);
    const [error, setError] = useState(null);
    const [socket, setSocket] = useState(null);
    const [wsConnected, setWsConnected] = useState(false);

    // Initial data fetch
    const fetchMatch = async () => {
        try {
            console.log('🔄 Fetching initial match data:', { matchId, tournamentId });
            const response = await apiCall(endpoints.getMatchScore, {
                method: "GET",
                params: {
                    match_id: matchId,
                    tournament_id: tournamentId,
                },
            });

            if (response) {
                console.log('📊 Initial score data received:', response);
                setScoreData(response);
            }
        } catch (error) {
            console.error('❌ Failed to fetch match:', error);
            setError(error.message);
        }
    };

    // Socket.IO connection setup
    const setupSocket = useCallback(() => {
        const baseUrl = endpoints.getBaseUrl();
        console.log('🔌 Initializing Socket.IO connection to:', baseUrl);

        const newSocket = io(`${baseUrl}/scores`, {
            path: '/socket.io',
            transports: ['websocket'],
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: 5
        });

        newSocket.on('connect', () => {
            console.log('✅ Socket.IO connected');
            setWsConnected(true);

            // Subscribe to match updates
            const subscriptionMessage = {
                tournament_id: tournamentId,
                match_id: matchId
            };
            console.log('📡 Sending subscription:', subscriptionMessage);
            newSocket.emit('subscribe', subscriptionMessage);
        });

        newSocket.on('score_update', (data) => {
            console.log('📨 Score update received:', data);
            if (data.match_id === matchId) {
                setScoreData(prev => ({
                    ...prev,
                    team1: {
                        ...prev.team1,
                        team_id: data.team1_id,
                        score: data.team1_score
                    },
                    team2: {
                        ...prev.team2,
                        team_id: data.team2_id,
                        score: data.team2_score
                    }
                }));
            }
        });

        newSocket.on('connect_error', (error) => {
            console.error('❌ Socket connection error:', error);
            setWsConnected(false);
        });

        newSocket.on('disconnect', (reason) => {
            console.log('🔌 Socket disconnected:', reason);
            setWsConnected(false);
        });

        newSocket.on('error', (error) => {
            console.error('❌ Socket error:', error);
        });

        setSocket(newSocket);

        return () => {
            if (newSocket) {
                console.log('🔌 Cleaning up Socket.IO connection');
                newSocket.disconnect();
            }
        };
    }, [matchId, tournamentId]);

    // Initial setup
    useEffect(() => {
        if (!matchId || !tournamentId) {
            console.log('⚠️ Missing required IDs:', { matchId, tournamentId });
            return;
        }

        console.log('🚀 Initializing MatchOverlay:', { matchId, tournamentId });

        // Fetch initial data
        fetchMatch();

        // Setup Socket.IO
        const cleanup = setupSocket();

        // Cleanup function
        return () => {
            cleanup();
        };
    }, [matchId, tournamentId, setupSocket]);

    // Connection status indicator (optional)
    useEffect(() => {
        console.log('📡 WebSocket connection status:', wsConnected ? 'Connected' : 'Disconnected');
    }, [wsConnected]);

    if (error) {
        console.error('❌ Error in MatchOverlay:', error);
        return null;
    }

    if (!scoreData) {
        console.log('⏳ Waiting for score data...');
        return null;
    }

    return (
        <div className={stl.overlay}>
            <div className={stl.scoreContainer}>
                <Image
                    src="/score_bg.png"
                    alt="Score Background"
                    fill
                    className={stl.scoreBg}
                />
                <div className={stl.scoreContent}>
                    {scoreData.result_type === 'walkover' ? (
                        <div className={stl.walkoverDisplay}>
                            <div className={stl.walkoverBadge}>WALKOVER</div>
                            <div className={stl.winnerInfo}>
                                Winner: T{scoreData.winner_team_id}
                            </div>
                            {scoreData.walkover_reason && (
                                <div className={stl.walkoverReason}>
                                    Reason: {scoreData.walkover_reason}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className={stl.score}>
                            <span className={stl.teamId}>T{scoreData.team1?.team_id}</span>
                            <span className={stl.scoreValue}>{scoreData.team1?.score || '0'}</span>
                            <span className={stl.scoreValue}>{scoreData.team2?.score || '0'}</span>
                            <span className={stl.teamId}>T{scoreData.team2?.team_id}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className={stl.logos}>
                <div className={stl.khelClubLogo}>
                    <Image
                        src="/logo.png"
                        alt="Khel Club Logo"
                        width={80}
                        height={80}
                    />
                </div>
                <div className={stl.streamingLogo}>
                    <Image
                        src="/sportvot.png"
                        alt="Sportvot"
                        width={150}
                        height={150}
                    />
                </div>
            </div>
        </div>
    );
};

export default MatchOverlay;
