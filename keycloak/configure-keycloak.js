const axios = require('axios');
const keycloakUrl = process.env.CONFIG_KEYCLOAK_URL;
const adminUsername = process.env.CONFIG_KEYCLOAK_ADMIN_USERNAME;
const adminPassword = process.env.CONFIG_KEYCLOAK_ADMIN_PASSWORD;
const realmName = process.env.CONFIG_KEYCLOAK_REALM_NAME;
const frontendClientId = process.env.CONFIG_KEYCLOAK_FRONTEND_CLIENT_ID;
const backendClientId = process.env.CONFIG_KEYCLOAK_BACKEND_CLIENT_ID;
const clientSecret = process.env.CONFIG_KEYCLOAK_CLIENT_SECRET;
const username = process.env.CONFIG_KEYCLOAK_USER_USERNAME;
const password = process.env.CONFIG_KEYCLOAK_USER_PASSWORD;
const recreateRealm = process.env.CONFIG_KEYCLOAK_RECREATE_REALM === 'true';

const redirectUris = process.env.CONFIG_KEYCLOAK_REDIRECT_URIS ? process.env.CONFIG_KEYCLOAK_REDIRECT_URIS.split(',') : [];

const webOrigins = process.env.CONFIG_KEYCLOAK_WEB_ORIGINS ? process.env.CONFIG_KEYCLOAK_WEB_ORIGINS.split(',') : [];

const maxRetries = parseInt(process.env.CONFIG_KEYCLOAK_MAX_RETRIES, 10);
const retryInterval = parseInt(process.env.CONFIG_KEYCLOAK_RETRY_INTERVAL, 10);

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getAdminAccessToken() {
    try {
        const response = await axios.post(`${keycloakUrl}/realms/master/protocol/openid-connect/token`, new URLSearchParams({
            client_id: 'admin-cli',
            username: adminUsername,
            password: adminPassword,
            grant_type: 'password'
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        return response.data.access_token;
    } catch (error) {
        console.error('Failed to get admin access token:', error.response ? error.response.data : error.message);
        throw error;
    }
}

async function realmExists(token) {
    try {
        await axios.get(`${keycloakUrl}/admin/realms/${realmName}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return true;
    } catch (error) {
        if (error.response && error.response.status === 404) {
            return false;
        }
        throw error;
    }
}

async function deleteRealm(token) {
    try {
        await axios.delete(`${keycloakUrl}/admin/realms/${realmName}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        console.log('Realm deleted successfully');
    } catch (error) {
        console.error('Failed to delete realm:', error.response ? error.response.data : error.message);
        throw error;
    }
}

async function clientExists(token, clientId) {
    try {
        const response = await axios.get(`${keycloakUrl}/admin/realms/${realmName}/clients`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.data.some(client => client.clientId === clientId);
    } catch (error) {
        throw error;
    }
}

async function userExists(token) {
    try {
        const response = await axios.get(`${keycloakUrl}/admin/realms/${realmName}/users`, {
            headers: {
                'Authorization': `Bearer ${token}`
            },
            params: {
                username: username
            }
        });
        return response.data.length > 0;
    } catch (error) {
        throw error;
    }
}

async function createRealm(token) {
    if (await realmExists(token)) {
        console.log('Realm already exists');
        return;
    }

    try {
        await axios.post(`${keycloakUrl}/admin/realms`, {
            realm: realmName,
            enabled: true,
            attributes: {
                'contentSecurityPolicy': "frame-ancestors *"
            }
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('Realm created successfully');
    } catch (error) {
        console.error('Failed to create realm:', error.response ? error.response.data : error.message);
        throw error;
    }
}

async function createClient(token, clientId, isPublic) {
    if (await clientExists(token, clientId)) {
        console.log(`Client ${clientId} already exists`);
        return;
    }

    try {
        const response = await axios.post(`${keycloakUrl}/admin/realms/${realmName}/clients`, {
            clientId: clientId,
            enabled: true,
            publicClient: isPublic,
            secret: isPublic ? undefined : clientSecret,
            redirectUris: redirectUris,
            webOrigins: webOrigins,
            directAccessGrantsEnabled: true
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const client = response.data;

        if (!isPublic) {
            const rolesResponse = await axios.get(`${keycloakUrl}/admin/realms/${realmName}/roles`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const introspectRole = rolesResponse.data.find(role => role.name === 'introspect');
            if (introspectRole) {
                await axios.post(`${keycloakUrl}/admin/realms/${realmName}/clients/${client.id}/roles`, {
                    role: introspectRole
                }, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
            }
        }
    } catch (error) {
        console.error(`Failed to create client ${clientId}:`, error.response ? error.response.data : error.message);
        throw error;
    }
}

async function createUser(token) {
    if (await userExists(token)) {
        console.log('User already exists');
        return;
    }

    try {
        await axios.post(`${keycloakUrl}/admin/realms/${realmName}/users`, {
            username: username,
            enabled: true,
            credentials: [
                {
                    type: 'password',
                    value: password,
                    temporary: false
                }
            ]
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('User created successfully');
    } catch (error) {
        console.error('Failed to create user:', error.response ? error.response.data : error.message);
        throw error;
    }
}

async function configureKeycloak() {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const token = await getAdminAccessToken();

            if (recreateRealm) {
                if (await realmExists(token)) {
                    await deleteRealm(token);
                }
            }

            await createRealm(token);
            await createClient(token, frontendClientId, true);
            await createClient(token, backendClientId, false);
            await createUser(token);
            console.log('Keycloak configuration completed.');
            return;
        } catch (error) {
            console.error(`Error configuring Keycloak: ${error.response ? JSON.stringify(error.response.data, null, 2) : error.message}`);
            console.log(`Retrying in ${retryInterval / 1000} seconds... (${i + 1}/${maxRetries})`);
            await sleep(retryInterval);
        }
    }
    console.error('Failed to configure Keycloak after multiple attempts.');
}

(async () => {
    await configureKeycloak();
})();
