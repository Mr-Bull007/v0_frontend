'use client'
import { useState, useEffect } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import stl from "./Landing.module.scss";
import { useRouter } from "next/navigation";
import { endpoints } from "@/store/urls";
import toast from "react-hot-toast";
import { Header } from "@/components/header";
import { apiCall } from "@/store/utils";

const LandingScreen = () => {
    const [tournament, setTournament] = useState(null);
    const [loading, setLoading] = useState(false);
    const [typingTimeout, setTypingTimeout] = useState(null);
    const router = useRouter();

    const formik = useFormik({
        initialValues: {
            tournamentId: "",
            seasonId: "",
            categoryId: ""
        },
        validationSchema: Yup.object({
            tournamentId: Yup.string().required('Tournament ID is required'),
            seasonId: Yup.string().when('tournamentId', {
                is: (val) => val && val.length > 0,
                then: () => Yup.string().required('Season is required')
            }),
            categoryId: Yup.string().when('seasonId', {
                is: (val) => val && val.length > 0,
                then: () => Yup.string().required('Category is required')
            })
        }),
        onSubmit: async (values) => {
            try {
                const response = await apiCall(`${endpoints.getTournamentDetails}/${values.categoryId}`);
                if (response) {
                    sessionStorage.setItem("tournamentId", values.categoryId);
                    router.push(`/tournament/${values.categoryId}`);
                } else {
                    toast.error("Invalid Tournament ID. Please try again.");
                }
            } catch (error) {
                toast.error("Error fetching tournament details");
                console.error(error);
            }
        }
    });

    const fetchTournamentDetails = async (id) => {
        try {
            setLoading(true);
            const response = await apiCall(`${endpoints.getSuperTournamentDetails}/${id}`);
            setTournament(response || null);
            formik.setFieldValue('seasonId', '');
            formik.setFieldValue('categoryId', '');
        } catch (error) {
            console.error('Error fetching tournament details:', error);
            toast.error('Failed to fetch tournament details');
            setTournament(null);
            formik.setFieldValue('seasonId', '');
            formik.setFieldValue('categoryId', '');
        } finally {
            setLoading(false);
        }
    };

    const handleTournamentChange = (e) => {
        const id = e.target.value.trim();
        formik.handleChange(e);

        if (typingTimeout) {
            clearTimeout(typingTimeout);
        }

        if (id) {
            const newTimeout = setTimeout(() => {
                fetchTournamentDetails(id);
            }, 500);
            setTypingTimeout(newTimeout);
        } else {
            setTournament(null);
            formik.setFieldValue('seasonId', '');
            formik.setFieldValue('categoryId', '');
        }
    };

    const getCategories = () => {
        const season = tournament?.seasons?.find(s => s.id.toString() === formik.values.seasonId);
        return season?.tournaments || [];
    };

    return (
        <div className={stl.container}>
            <Header />
            <div className={stl.content}>
                <form onSubmit={formik.handleSubmit} className={stl.form}>
                    <h1>Tournament Selection</h1>
                    <div className={stl.formSection}>
                        <div className={stl.formGroup}>
                            <label>Tournament ID</label>
                            <input
                                type="text"
                                name="tournamentId"
                                placeholder="Enter Tournament ID"
                                onChange={handleTournamentChange}
                                onBlur={formik.handleBlur}
                                value={formik.values.tournamentId}
                                className={stl.inputField}
                            />
                            {formik.touched.tournamentId && formik.errors.tournamentId && (
                                <div className={stl.errorMessage}>{formik.errors.tournamentId}</div>
                            )}
                        </div>

                        {loading && <div className={stl.loading}>Loading tournament details...</div>}

                        {tournament && (
                            <div className={stl.tournamentInfo}>
                                <p><strong>Tournament Name:</strong> {tournament.name}</p>
                            </div>
                        )}

                        <div className={stl.formGroup}>
                            <label>Season</label>
                            <select
                                name="seasonId"
                                onChange={(e) => {
                                    formik.handleChange(e);
                                    formik.setFieldValue('categoryId', '');
                                }}
                                onBlur={formik.handleBlur}
                                value={formik.values.seasonId}
                                disabled={!tournament || loading}
                                className={stl.inputField}
                            >
                                <option value="">Select Season</option>
                                {tournament?.seasons?.map(season => (
                                    <option key={season.id} value={season.id}>
                                        {season.name}
                                    </option>
                                ))}
                            </select>
                            {formik.touched.seasonId && formik.errors.seasonId && (
                                <div className={stl.errorMessage}>{formik.errors.seasonId}</div>
                            )}
                        </div>

                        <div className={stl.formGroup}>
                            <label>Category</label>
                            <select
                                name="categoryId"
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                value={formik.values.categoryId}
                                disabled={!formik.values.seasonId}
                                className={stl.inputField}
                            >
                                <option value="">Select Category</option>
                                {getCategories().map(category => (
                                    <option key={category.id} value={category.id}>
                                        {category.name.split('~')[0]}
                                    </option>
                                ))}
                            </select>
                            {formik.touched.categoryId && formik.errors.categoryId && (
                                <div className={stl.errorMessage}>{formik.errors.categoryId}</div>
                            )}
                        </div>
                    </div>

                    <button type="submit" className={stl.submitButton} disabled={!formik.values.categoryId}>
                        View Tournament
                    </button>
                </form>

                <div className={stl.navigationLinks}>
                    <button
                        type="button"
                        className={stl.navButton}
                        onClick={() => router.push('/referee')}
                    >
                        Go to Referee Portal
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LandingScreen;
