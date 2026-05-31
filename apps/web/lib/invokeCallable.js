const REGION = "asia-southeast1";

function getProjectId() {
  return (
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT_ID ||
    ""
  );
}

export async function invokeCallable(functionName, data, idToken) {
  const projectId = getProjectId();
  if (!projectId) {
    throw new Error("Firebase project ID is not configured.");
  }

  const url = `https://${REGION}-${projectId}.cloudfunctions.net/${functionName}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify({ data }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.error) {
    const message =
      payload.error?.message ||
      payload.message ||
      `Callable ${functionName} failed (${response.status}).`;
    const error = new Error(message);
    error.status = payload.error?.status || response.status;
    throw error;
  }

  return payload.result ?? payload.data ?? payload;
}
