import { init } from "@instantdb/admin";

export const getInstantAdmin = () => {
  const appId = process.env.INSTANT_APP_ID;
  const adminToken = process.env.INSTANT_ADMIN_TOKEN;

  if (!appId || !adminToken) {
    throw new Error("INSTANT_APP_ID and INSTANT_ADMIN_TOKEN must be defined");
  }

  return init({
    appId,
    adminToken,
  });
};
