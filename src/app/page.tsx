"use client";
import { useState, useEffect } from "react";
import { useAgent } from "./context/agent";
import { OTPInput } from "input-otp";

export default function Home() {
  const { agent, isLoggedIn, checkHandleAvailability, sendEmailVerification, verifyEmail } = useAgent();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    otp: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isCheckingHandle, setIsCheckingHandle] = useState(false);
  const [handleStatus, setHandleStatus] = useState<{
    available: boolean;
    checked: boolean;
    suggestedHandles?: string[];
  }>({ available: false, checked: false });

  useEffect(() => {
    // Check if user is logged in but not verified
    if (isLoggedIn) {
      // Check if email is verified
      const checkVerification = async () => {
        try {
          const session = localStorage.getItem("bsky-session");
          if (session) {
            const sessionData = JSON.parse(session);
            // If we have a session but no email verification, go to verification step
            if (!sessionData.emailVerified) {
              setStep(4);
              // Get the email from the session
              setFormData(prev => ({ ...prev, email: sessionData.email }));
            }
          }
        } catch (error) {
          console.error("Error checking verification status:", error);
        }
      };
      checkVerification();
    }
  }, [isLoggedIn]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Reset handle status when username changes
    if (name === 'username') {
      setHandleStatus({ available: false, checked: false });
      setError("");
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (step === 1 && !handleStatus.checked) {
        await checkUsernameAvailability();
      }
    }
  };

  const checkUsernameAvailability = async () => {
    if (!formData.username || formData.username.length < 3) return;

    setIsCheckingHandle(true);
    try {
      const result = await checkHandleAvailability(formData.username);
      setHandleStatus({
        available: result.available,
        checked: true,
        suggestedHandles: result.suggestedHandles
      });

      if (!result.available) {
        setError(`Username "${formData.username}" is not available.`);
      } else {
        setError("");
      }
    } catch (err) {
      console.error("Error checking handle:", err);
      setError("Could not check username availability");
    } finally {
      setIsCheckingHandle(false);
    }
  };

  const handleNextStep = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (step === 1) {
      // Check username availability before proceeding
      if (!handleStatus.checked) {
        await checkUsernameAvailability();
        if (!handleStatus.available) {
          return; // Don't proceed if handle is not available
        }
      }
    }

    if (step === 3) {
      // On the password step, attempt to create account
      setIsSubmitting(true);
      try {
        if (agent) {
          await agent.createAccount({
            email: formData.email,
            password: formData.password,
            handle: formData.username + ".tor0n.to",
          });
          await agent.login({
            identifier: formData.email,
            password: formData.password,
          });
          await agent.api.com.atproto.server.requestEmailConfirmation();
          setStep(step + 1);
        }
      } catch (err) {
        console.error("Authentication error:", err);
        setError("Failed to create account. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    } else if (step === 4) {
      await verifyEmail(formData.email, formData.otp);
      setStep(step + 1);
    } else {
      // For other steps, just proceed to next step
      setStep(step + 1);
    }
  };

  // Common input styles applied to all form fields for consistency
  const inputStyles = "w-full px-4 py-3 bg-black/20 backdrop-blur-sm text-white/90 placeholder-white/30 border-b-2 border-white/20 rounded-sm focus:outline-none focus:border-white/40 transition-all text-lg";
  const buttonStyles = "w-full py-3 bg-white/10 hover:bg-white/20 rounded-sm text-white transition-colors flex items-center justify-center gap-2";
  const headerStyles = "grid gap-2 text-left";
  const formContainerStyles = "grid h-[300px] w-full grid-rows-[auto_1fr_auto] gap-4";
  const feedbackContainerStyles = "min-h-[80px] w-full flex flex-col";
  const footerTextStyles = "text-xs text-white/50";

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="w-full grid gap-8">
            <div className={headerStyles}>
              <h1 className="text-xl font-bold text-white">
                Welcome to TorontoID.
              </h1>
              <div className="space-y-1">
                <p className="text-lg text-white/90">
                  TorontoID helps you explore your city, <br />
                  connect with community, & own <br />
                  your digital presence.
                </p>
              </div>
              <p className="text-lg text-white/80">
                Pick a <strong>username</strong> to get started.
              </p>
            </div>

            <form onSubmit={handleNextStep} className={formContainerStyles}>
              <div className="w-full">
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  onBlur={checkUsernameAvailability}
                  placeholder="username"
                  className={inputStyles}
                  required
                  minLength={3}
                  disabled={isCheckingHandle}
                />
              </div>

              <div className={feedbackContainerStyles}>
                {error && (
                  <div className="text-red-400 text-sm -mt-2">
                    {error}
                    {handleStatus.suggestedHandles && (
                      <div className="mt-0.5">
                        <p className="text-white/70 text-xs mb-0.5">Try one of these instead:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {handleStatus.suggestedHandles.map((handle, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => {
                                setFormData(prev => ({ ...prev, username: handle }));
                                setHandleStatus({ available: true, checked: true });
                                setError("");
                              }}
                              className="px-3 py-1 text-xs bg-white/10 hover:bg-white/20 rounded-sm text-white/80"
                            >
                              @{handle}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {handleStatus.available && handleStatus.checked && (
                  <p className="text-green-400 text-sm">Username is available!</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isCheckingHandle || !handleStatus.available}
                className={buttonStyles}
              >
                {isCheckingHandle ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Continue
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>
            </form>
          </div>
        );
      case 2:
        return (
          <div className="w-full grid gap-8">
            <div className={headerStyles}>
              <h1 className="text-xl font-bold text-white">
                Enter your email
              </h1>
              <p className="text-lg text-white/80">
                We&apos;ll use this to verify your account.
              </p>
            </div>

            <form onSubmit={handleNextStep} className={formContainerStyles}>
              <div className="w-full">
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="email address"
                  className={inputStyles}
                  required
                />
              </div>

              <div className={feedbackContainerStyles}></div>

              <button type="submit" className={buttonStyles}>
                Continue
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>

              <p className={footerTextStyles}>
                by continuing, you consent to receive emails
              </p>
            </form>
          </div>
        );
      case 3:
        return (
          <div className="w-full grid gap-8">
            <div className={headerStyles}>
              <h1 className="text-xl font-bold text-white">
                Create a password
              </h1>
              <p className="text-lg text-white/80">
                Make sure it&apos;s secure.
              </p>
            </div>

            <form onSubmit={handleNextStep} className={formContainerStyles}>
              <div className="w-full">
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="password"
                  className={inputStyles}
                  required
                  minLength={8}
                  disabled={isSubmitting}
                />
              </div>

              <div className={feedbackContainerStyles}>
                {error && (
                  <p className="text-red-400 text-sm">{error}</p>
                )}
              </div>

              <button type="submit" disabled={isSubmitting} className={buttonStyles}>
                {isSubmitting ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Continue
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>

              <p className={footerTextStyles}>
                Password must be at least 8 characters
              </p>
            </form>
          </div>
        );
      case 4:
        return (
          <div className="w-full grid gap-8">
            <div className={headerStyles}>
              <h1 className="text-xl font-bold text-white">
                Verify your account
              </h1>
              <p className="text-lg text-white/80">
                Enter the code we sent to {formData.email}
              </p>
            </div>

            <form onSubmit={handleNextStep} className={formContainerStyles}>
              <div className="w-full">
                <OTPInput
                  maxLength={10}
                  value={formData.otp}
                  onChange={(value) => setFormData(prev => ({ ...prev, otp: value }))}
                  containerClassName="flex gap-2"
                  pasteTransformer={(pasted) => pasted.replaceAll('-', '')}
                  render={({ slots }) => (
                    <div className="flex gap-2">
                      {slots.map((slot, idx) => (
                        <div
                          key={idx}
                          className="w-10 h-12 bg-black/20 backdrop-blur-sm text-white/90 border-b-2 border-white/20 rounded-sm flex items-center justify-center"
                        >
                          {slot.char}
                        </div>
                      ))}
                    </div>
                  )}
                />
              </div>

              <div className={feedbackContainerStyles}></div>

              <button type="submit" className={buttonStyles}>
                Continue
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>

              <p className={footerTextStyles}>
                Didn&apos;t receive the code? <button type="button" onClick={() => sendEmailVerification()} className="text-white/70 underline">Resend</button>
              </p>
            </form>
          </div>
        );
      case 5:
        return (
          <div className="w-full grid gap-8">
            <div className={headerStyles}>
              <h1 className="text-xl font-bold text-white">
                Welcome to TorontoID, @{agent?.session?.handle?.split('.')[0] || formData.username}.
              </h1>
              <p className="text-lg text-white/80">
                Account created! Stay tuned for more.
              </p>
            </div>

            <div className={formContainerStyles}>
              <button
                className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-sm text-white transition-colors"
                onClick={() => {
                  agent?.logout();
                  setStep(1);
                }}
              >
                Logout
              </button>

              <div className={feedbackContainerStyles}></div>

              <div className={footerTextStyles}></div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <main className="min-h-screen bg-[#567A9E] grid place-items-center p-12">
      <div className="w-full max-w-md">
        {renderStep()}
      </div>
    </main>
  );
}
