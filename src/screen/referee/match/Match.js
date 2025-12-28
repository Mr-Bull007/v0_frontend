'use client'

import { useEffect, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useRouter } from "next/navigation";
import { endpoints } from "@/store/urls";
import { apiCall } from "@/store/utils";
import stl from "./Match.module.scss";
import toast from "react-hot-toast";
import { TextField } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Dialog, DialogActions, DialogContent, DialogTitle, Button } from "@mui/material";

const MatchScreen = ({ tournamentId, matchId }) => {
    const [scoreData, setScoreData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setModalOpen] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [showWalkoverModal, setShowWalkoverModal] = useState(false);
    const [walkoverData, setWalkoverData] = useState({ winnerTeamId: '', reason: '' });
    const [matchStatus, setMatchStatus] = useState(null);
    const router = useRouter();

    const getScores = async () => {
        setLoading(true);
        try {
            if (!tournamentId) {
                throw new Error("Tournament ID is missing");
            }

            const response = await apiCall(endpoints.getMatchScore, {
                method: "GET",
                params: {
                    match_id: matchId,
                    tournament_id: tournamentId,
                },
            });

            if (!response) {
                throw new Error("Failed to fetch match details");
            }

            setMatchStatus(response.status || 'pending');

            if (response.status === 'completed') {
                setShowStatusModal(true);
            } else if (response.status === 'pending') {
                setShowStatusModal(true);
            }

            setScoreData(response);
            if (response.team1?.score !== undefined) {
                formik.setFieldValue("team1Score", response.team1.score);
            }
            if (response.team2?.score !== undefined) {
                formik.setFieldValue("team2Score", response.team2.score);
            }

            // If match is already a walkover, populate walkover data
            if (response.result_type === 'walkover') {
                setWalkoverData({
                    winnerTeamId: response.winner_team_id || '',
                    reason: response.walkover_reason || ''
                });
            }
        } catch (error) {
            console.error("Failed to fetch Score:", error.message);
            toast.error(error.message || "Failed to fetch match details");
            setScoreData(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (tournamentId && matchId) {
            getScores();
        }
    }, [tournamentId, matchId]);

    const formik = useFormik({
        initialValues: {
            team1Score: 0,
            team2Score: 0,
        },
        validationSchema: Yup.object({
            team1Score: Yup.number().min(0, "Score cannot be negative").required("Required"),
            team2Score: Yup.number().min(0, "Score cannot be negative").required("Required"),
        }),
        onSubmit: (values) => updateScore(),
    });

    const handleScoreChange = (team, scoreChange) => {
        formik.setFieldValue(
            team === "team1" ? "team1Score" : "team2Score",
            Math.max(formik.values[team === "team1" ? "team1Score" : "team2Score"] + scoreChange, 0)
        );
    };

    const resetScore = (team) => {
        formik.setFieldValue(team === "team1" ? "team1Score" : "team2Score", 0);
    };

    const updateScore = async (isFinal = false, override = false) => {
        try {
            const requestBody = {
                tournament_id: tournamentId,
                match_id: matchId,
                score: `${formik.values.team1Score}-${formik.values.team2Score}`,
                final: isFinal,
                override: override
            };

            const scorePromise = fetch(endpoints.updateMatchScore, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(requestBody),
            });

            const statusPromise = isFinal ?
                apiCall(`${endpoints.updateMatchStatus}/${matchId}`, {
                    method: "POST",
                    body: {
                        tournament_id: tournamentId,
                        status: "completed"
                    }
                }) : Promise.resolve();

            const [response, statusResponse] = await Promise.all([
                scorePromise,
                statusPromise
            ]);

            const resp = await response.json();

            if (!response.ok) {
                if (response.status === 404) {
                    toast.error("Tournament or match not found");
                } else if (response.status === 400) {
                    if (resp.error.includes("already been finalized")) {
                        const shouldOverride = window.confirm("Match is already finalized. Would you like to override?");
                        if (shouldOverride) {
                            return updateScore(isFinal, true);
                        }
                    }
                    toast.error(resp.error);
                } else {
                    toast.error("An error occurred while updating the score");
                }
                throw new Error(`Error ${response.status}: ${resp.error}`);
            }

            if (resp) {
                toast.success(resp.message);
                formik.setFieldValue("team1Score", resp.team1_score);
                formik.setFieldValue("team2Score", resp.team2_score);

                if (isFinal && resp.winner_team_id) {
                    setScoreData(prev => ({
                        ...prev,
                        winner_team_id: resp.winner_team_id
                    }));
                    setMatchStatus('completed');
                }

                if (isFinal) {
                    router.push(`/referee/${tournamentId}/matches`);
                }
            }
        } catch (error) {
            console.error("Failed to update score:", error);
            toast.error("Failed to update score. Please try again.");
        }
    };

    const finalizeScore = () => {
        setModalOpen(true);
    };

    const confirmFinalize = () => {
        setModalOpen(false);
        updateScore(true);
    };

    const handleStartMatch = async () => {
        try {
            await apiCall(`${endpoints.updateMatchStatus}/${matchId}`, {
                method: "POST",
                body: {
                    tournament_id: tournamentId,
                    status: "on-going"
                }
            });

            setMatchStatus('on-going');
            setShowStatusModal(false);
            toast.success("Match started successfully");
        } catch (error) {
            console.error("Failed to start match:", error);
            toast.error(error.message || "Failed to start match");
        }
    };

    const handleBackToMatches = () => {
        router.push(`/referee/${tournamentId}/matches`);
    };

    const handleWalkoverSubmit = async () => {
        if (!walkoverData.winnerTeamId) {
            toast.error('Please select a winning team');
            return;
        }

        try {
            const requestBody = {
                tournament_id: tournamentId,
                match_id: matchId,
                result_type: 'walkover',
                winner_team_id: walkoverData.winnerTeamId,
                walkover_reason: walkoverData.reason || null
            };

            const response = await fetch(endpoints.updateMatchScore, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(requestBody),
            });

            const resp = await response.json();

            if (!response.ok) {
                toast.error(resp.error || 'Failed to record walkover');
                return;
            }

            toast.success('Walkover recorded successfully');
            setShowWalkoverModal(false);

            // Update match status
            await apiCall(`${endpoints.updateMatchStatus}/${matchId}`, {
                method: "POST",
                body: {
                    tournament_id: tournamentId,
                    status: "completed"
                }
            });

            // Refresh match data
            await getScores();

            // Navigate back after a short delay
            setTimeout(() => {
                router.push(`/referee/${tournamentId}/matches`);
            }, 1500);
        } catch (error) {
            console.error("Failed to record walkover:", error);
            toast.error("Failed to record walkover. Please try again.");
        }
    };

    if (loading) {
        return <div className={stl.loading}>Loading match details...</div>;
    }

    if (!scoreData) {
        return <div className={stl.error}>No match data available</div>;
    }

    return (
        <div className={stl.container}>
            <div className={stl.header}>
                <button onClick={handleBackToMatches}>
                    <ArrowBackIcon />
                </button>
                <h2>Update Score</h2>
            </div>

            <div className={stl.matchInfo}>
                <div className={stl.infoItem}>
                    <span className={stl.label}>Status:</span>
                    <span className={`${stl.value} ${stl[matchStatus?.replace('-', '_')] || ''}`}>
                        {matchStatus ? matchStatus.charAt(0).toUpperCase() + matchStatus.slice(1) : 'Unknown'}
                    </span>
                </div>
                {scoreData?.result_type === 'walkover' && (
                    <div className={stl.infoItem} style={{ backgroundColor: '#fff3e0', padding: '0.5rem', borderRadius: '4px', marginTop: '0.5rem' }}>
                        <span className={stl.label} style={{ color: '#ff9800', fontWeight: 'bold' }}>WALKOVER</span>
                        {scoreData.walkover_reason && (
                            <span className={stl.value} style={{ marginLeft: '0.5rem' }}>
                                Reason: {scoreData.walkover_reason}
                            </span>
                        )}
                        {scoreData.winner_team_id && (
                            <span className={stl.value} style={{ marginLeft: '0.5rem' }}>
                                Winner: Team {scoreData.winner_team_id}
                            </span>
                        )}
                    </div>
                )}
                <div className={stl.infoItem}>
                    <span className={stl.label}>Tournament ID:</span>
                    <span className={stl.value}>{tournamentId}</span>
                </div>
                <div className={stl.infoItem}>
                    <span className={stl.label}>Match ID:</span>
                    <span className={stl.value}>{matchId}</span>
                </div>
            </div>

            {scoreData?.result_type === 'walkover' ? (
                <div className={stl.walkoverDisplay} style={{
                    padding: '2rem',
                    textAlign: 'center',
                    backgroundColor: '#fff3e0',
                    borderRadius: '8px',
                    marginTop: '1rem'
                }}>
                    <h3 style={{ color: '#ff9800', marginBottom: '1rem' }}>This match was recorded as a WALKOVER</h3>
                    <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                        <strong>Winner:</strong> Team {scoreData.winner_team_id}
                    </p>
                    {scoreData.walkover_reason && (
                        <p style={{ fontSize: '1rem', color: '#666' }}>
                            <strong>Reason:</strong> {scoreData.walkover_reason}
                        </p>
                    )}
                </div>
            ) : (
                <form onSubmit={formik.handleSubmit} className={stl.scoreForm}>
                    <div className={stl.teams}>
                        <TeamCard
                            team={scoreData.team1}
                            players={scoreData.team1?.players || []}
                            onScoreChange={(change) => handleScoreChange("team1", change)}
                            onReset={() => resetScore("team1")}
                            formik={formik}
                            teamName="team1Score"
                        />

                        <div className={stl.vs}>VS</div>

                        <TeamCard
                            team={scoreData.team2}
                            players={scoreData.team2?.players || []}
                            onScoreChange={(change) => handleScoreChange("team2", change)}
                            onReset={() => resetScore("team2")}
                            formik={formik}
                            teamName="team2Score"
                        />
                    </div>

                    <div className={stl.actions}>
                        <button type="button" onClick={() => updateScore(false)}>Update</button>
                        <button type="button" onClick={finalizeScore}>Final</button>
                        <button
                            type="button"
                            onClick={() => setShowWalkoverModal(true)}
                            style={{ backgroundColor: '#ff9800', color: 'white' }}
                        >
                            Mark as Walkover
                        </button>
                    </div>
                </form>
            )}

            {isModalOpen && (
                <div className={stl.modal}>
                    <div className={stl.modalContent}>
                        <p>Are you sure you want to finalize the scores?</p>
                        <button onClick={confirmFinalize} style={{ backgroundColor: '#4CAF50', color: 'white' }}>Confirm</button>
                        <button onClick={() => setModalOpen(false)}>Cancel</button>
                    </div>
                </div>
            )}

            <Dialog
                open={showStatusModal}
                onClose={handleBackToMatches}
            >
                <DialogTitle>
                    {matchStatus === 'completed' ? 'Match Completed' : 'Match Not Started'}
                </DialogTitle>
                <DialogContent>
                    {matchStatus === 'completed' ? (
                        <p>This match has been completed. Would you like to override the scores?</p>
                    ) : (
                        <p>This match hasn't started yet. Would you like to start the match?</p>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={handleBackToMatches}
                        style={{ color: '#F28C28' }}
                    >
                        Cancel
                    </Button>
                    {matchStatus === 'completed' ? (
                        <Button
                            onClick={() => setShowStatusModal(false)}
                            style={{ color: '#4CAF50' }}
                        >
                            Override Score
                        </Button>
                    ) : (
                        <Button
                            onClick={handleStartMatch}
                            style={{ color: '#4CAF50' }}
                        >
                            Start Match
                        </Button>
                    )}
                </DialogActions>
            </Dialog>

            <Dialog
                open={showWalkoverModal}
                onClose={() => setShowWalkoverModal(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Mark Match as Walkover</DialogTitle>
                <DialogContent>
                    <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                            Select Winning Team:
                        </label>
                        <select
                            value={walkoverData.winnerTeamId}
                            onChange={(e) => setWalkoverData({ ...walkoverData, winnerTeamId: e.target.value })}
                            style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}
                        >
                            <option value="">-- Select Team --</option>
                            {scoreData?.team1?.team_id && (
                                <option value={scoreData.team1.team_id}>
                                    Team {scoreData.team1.team_id} - {scoreData.team1.name}
                                </option>
                            )}
                            {scoreData?.team2?.team_id && (
                                <option value={scoreData.team2.team_id}>
                                    Team {scoreData.team2.team_id} - {scoreData.team2.name}
                                </option>
                            )}
                        </select>
                    </div>
                    <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                            Walkover Reason (Optional):
                        </label>
                        <TextField
                            fullWidth
                            multiline
                            rows={3}
                            placeholder="e.g., Opponent did not show up, Injury, etc."
                            value={walkoverData.reason}
                            onChange={(e) => setWalkoverData({ ...walkoverData, reason: e.target.value })}
                        />
                    </div>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setShowWalkoverModal(false)}
                        style={{ color: '#F28C28' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleWalkoverSubmit}
                        style={{ backgroundColor: '#ff9800', color: 'white' }}
                        disabled={!walkoverData.winnerTeamId}
                    >
                        Record Walkover
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
};

const TeamCard = ({ team, players = [], onScoreChange, onReset, formik, teamName }) => (
    <div className={stl.teamCard}>
        <div className={stl.teamHeader}>
            <h4>Team {team?.team_id || 'Unknown'}</h4>
            <div className={stl.playerNames}>
                {players.map((player, index) => (
                    <p key={index} className={stl.playerName}>
                        {player.first_name} {player.last_name}
                        {index < players.length - 1 ? " & " : ""}
                    </p>
                ))}
            </div>
        </div>

        <TextField
            size="small"
            className={stl.score}
            value={formik.values[teamName]}
            onChange={(e) => formik.setFieldValue(teamName, Math.max(0, Number(e.target.value) || 0))}
            error={Boolean(formik.errors[teamName])}
            helperText={formik.errors[teamName]}
        />

        <div className={stl.scoreControls}>
            <button type="button" onClick={() => onScoreChange(1)}>+1</button>
            <button type="button" onClick={() => onScoreChange(-1)}>-1</button>
            <button type="button" className={stl.reset} onClick={onReset}>Reset</button>
        </div>
    </div>
);

export default MatchScreen;
