"use client";

import { createContext, useContext, ReactNode, useState, useEffect } from "react";
import { BskyAgent, AtpSessionEvent, AtpSessionData } from "@atproto/api";

interface AgentContextType {
    agent: BskyAgent | null;
    isLoggedIn: boolean;
    login: (identifier: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    checkHandleAvailability: (handle: string) => Promise<{ available: boolean; suggestedHandles?: string[] }>;
    createAccount: (handle: string, email: string, password: string) => Promise<void>;
    sendEmailVerification: () => Promise<void>;
    verifyEmail: (email: string, token: string) => Promise<void>;
}

const AgentContext = createContext<AgentContextType | undefined>(undefined);

export function AgentProvider({ children }: { children: ReactNode }) {
    const [agent, setAgent] = useState<BskyAgent | null>(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        // Initialize the agent on client-side only
        const newAgent = new BskyAgent({
            service: "https://tor0n.to",
            persistSession: (evt: AtpSessionEvent, sess?: AtpSessionData) => {
                // Handle session persistence
                if (evt === "create" || evt === "update") {
                    if (sess) {
                        // Add email verification status to session
                        const sessionWithVerification = {
                            ...sess,
                            emailVerified: false // Default to false, will be updated after verification
                        };
                        localStorage.setItem("bsky-session", JSON.stringify(sessionWithVerification));
                    }
                } else if (evt === "expired" || evt === "create-failed") {
                    localStorage.removeItem("bsky-session");
                }
            },
        });

        // Check for existing session
        const savedSession = localStorage.getItem("bsky-session");
        if (savedSession) {
            try {
                const sessionData = JSON.parse(savedSession) as AtpSessionData;
                newAgent.resumeSession(sessionData).then(() => {
                    setIsLoggedIn(true);
                }).catch(err => {
                    console.error("Failed to resume session:", err);
                    localStorage.removeItem("bsky-session");
                });
            } catch (error) {
                console.error("Error parsing saved session:", error);
                localStorage.removeItem("bsky-session");
            }
        }

        setAgent(newAgent);
    }, []);

    const login = async (identifier: string, password: string) => {
        if (!agent) return;

        try {
            await agent.login({ identifier, password });
            setIsLoggedIn(true);
        } catch (error) {
            console.error("Login failed:", error);
            throw error;
        }
    };

    const logout = async () => {
        if (!agent) return;

        try {
            await agent.logout();
            setIsLoggedIn(false);
            localStorage.removeItem("bsky-session");
        } catch (error) {
            console.error("Logout failed:", error);
            throw error;
        }
    };

    const createAccount = async (handle: string, email: string, password: string) => {
        if (!agent) return;

        try {
            await agent.createAccount({
                email: email,
                password: password,
                handle: handle + ".tor0n.to",
            });
            await agent.login({
                identifier: email,
                password: password,
            });
            await agent.api.com.atproto.server.requestEmailConfirmation();
            setIsLoggedIn(true);
        } catch (error) {
            console.error("Account creation failed:", error);
            throw error;
        }
    };

    const checkHandleAvailability = async (handle: string): Promise<{ available: boolean; suggestedHandles?: string[] }> => {
        if (!agent) {
            throw new Error("Agent not initialized");
        }

        try {
            // Format the handle correctly if needed
            let formattedHandle = handle;
            if (!handle.includes('.')) {
                formattedHandle = `${handle}.tor0n.to`;
            }

            // Check if the handle is available
            const result = await agent.com.atproto.identity.resolveHandle({ handle: formattedHandle })
                .catch(err => {
                    // If we get a specific error code for handle not found, it means it's available
                    if (err && err.status === 400) {
                        return { available: true };
                    }
                    throw err;
                });

            // If we got a successful response with a did, the handle is taken
            if (result && 'data' in result && 'did' in result.data) {
                // Generate some alternative suggestions
                const suggestedHandles = generateHandleSuggestions(handle);
                return {
                    available: false,
                    suggestedHandles
                };
            }

            // If we reached here and have an 'available' property, return it
            if (result && 'available' in result) {
                return result;
            }

            // Default response
            return { available: false };
        } catch (error) {
            console.error("Error checking handle availability:", error);
            // For certain errors, we might want to consider the handle as not available
            return { available: false };
        }
    };

    const sendEmailVerification = async () => {
        if (!agent) return;

        try {
            await agent.api.com.atproto.server.requestEmailConfirmation();
        } catch (error) {
            console.error("Error verifying email:", error);
            throw error;
        }
    }

    const verifyEmail = async (email: string, token: string) => {
        if (!agent) return;

        try {
            console.log(email, token);
            // Add a dash in the middle of the token
            const tokenLength = token.length;
            const middleIndex = Math.floor(tokenLength / 2);
            token = token.slice(0, middleIndex) + '-' + token.slice(middleIndex);
            await agent.api.com.atproto.server.confirmEmail({
                email: email,
                token: token,
            });
        } catch (error) {
            console.error("Error verifying email:", error);
            throw error;
        }
    }

    // Helper function to generate handle suggestions
    // !TODO: Make this better and have it generate valid handles
    const generateHandleSuggestions = (handle: string): string[] => {
        const baseName = handle.split('.')[0]; // Get the part before any domain
        const suggestions = [
            `${baseName}1`,
            `${baseName}2`,
            `${baseName}3`,
            `${baseName}_`,
            `${baseName}_id`,
            `${baseName}.id`,
        ];
        return suggestions;
    };

    return (
        <AgentContext.Provider value={{
            agent,
            isLoggedIn,
            login,
            logout,
            checkHandleAvailability,
            createAccount,
            sendEmailVerification,
            verifyEmail
        }}>
            {children}
        </AgentContext.Provider>
    );
}

export function useAgent() {
    const context = useContext(AgentContext);
    if (context === undefined) {
        throw new Error("useAgent must be used within an AgentProvider");
    }
    return context;
} 