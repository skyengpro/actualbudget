This is the main project to run [Actual](https://github.com/actualbudget/actual), a local-first personal finance tool. It comes with the latest version of Actual, and a server to persist changes and make data available across all devices.

### Getting Started

Actual is a local-first personal finance tool. It is 100% free and open-source, written in NodeJS, it has a synchronization element so that all your changes can move between devices without any heavy lifting.

If you are interested in contributing, or want to know how development works, see our [contributing](https://actualbudget.org/docs/contributing/) document we would love to have you.

Want to say thanks? Click the ⭐ at the top of the page.

### Using the CLI tool

Node.js v22 or higher is required for the @actual-app/sync-server npm package

**Install globally with npm:**

```bash
npm install --location=global @actual-app/sync-server
```

After installing, you can execute actual-server commands directly in your terminal.

**Usage**

```bash
actual-server [options]
```

**Available options**

| Command             | Description                  |
| ------------------- | ---------------------------- |
| `-h` or `--help`    | Print this list and exit.    |
| `-v` or `--version` | Print this version and exit. |
| `--config`          | Path to the config file.     |
| `--reset-password`  | Reset your password          |

**Examples**

Run with default configuration

```bash
actual-server
```

Run with custom configuration

```bash
actual-server --config ./config.json
```

Reset your password

```bash
actual-server --reset-password
```

### Authentication

Actual supports multiple authentication methods: password (default), OpenID Connect, and header-based authentication.

#### Password Authentication (Default)

No additional configuration needed. On first access, you'll be prompted to set a password.

#### OpenID Connect Authentication (Google, Microsoft, etc.)

To use OpenID Connect with providers like Google, Microsoft, or others:

**Step 1: Configure your OpenID Provider**

For **Google**:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth 2.0 Client ID**
5. Select **Web application** as the application type
6. Add your server URL to **Authorized JavaScript origins** (e.g., `http://localhost:5006`)
7. Add the callback URL to **Authorized redirect URIs**:
   ```
   http://localhost:5006/openid/callback
   ```
   (Replace `localhost:5006` with your actual server hostname)
8. Copy the **Client ID** and **Client Secret**

For **Microsoft/Azure AD**:
1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Click **New registration**
4. Add the redirect URI: `http://localhost:5006/openid/callback`
5. Under **Certificates & secrets**, create a new client secret
6. Copy the **Application (client) ID** and the secret value

**Step 2: Configure the Server**

Create a `config.json` file in your data directory (or sync-server root):

```json
{
  "loginMethod": "openid",
  "openId": {
    "discoveryURL": "https://accounts.google.com/.well-known/openid-configuration",
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "server_hostname": "http://localhost:5006"
  }
}
```

**Provider Discovery URLs:**

| Provider | Discovery URL |
|----------|---------------|
| Google | `https://accounts.google.com/.well-known/openid-configuration` |
| Microsoft | `https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration` |
| Auth0 | `https://YOUR_DOMAIN.auth0.com/.well-known/openid-configuration` |
| Keycloak | `https://YOUR_HOST/realms/YOUR_REALM/.well-known/openid-configuration` |

**Environment Variables Alternative:**

Instead of `config.json`, you can use environment variables:

```bash
export ACTUAL_LOGIN_METHOD=openid
export ACTUAL_OPENID_DISCOVERY_URL=https://accounts.google.com/.well-known/openid-configuration
export ACTUAL_OPENID_CLIENT_ID=your_client_id
export ACTUAL_OPENID_CLIENT_SECRET=your_client_secret
export ACTUAL_OPENID_SERVER_HOSTNAME=http://localhost:5006
```

**Step 3: Restart the Server**

Restart Actual server to apply the new configuration.

#### Troubleshooting

**Error: `redirect_uri_mismatch`**
- Ensure the redirect URI in your OAuth provider matches exactly: `http://your-server/openid/callback`
- Check for http vs https mismatch
- Verify there are no trailing slashes

**Error: `invalid_client`**
- Verify your client ID and client secret are correct
- Check that the OAuth app is not in "testing" mode with restricted users (Google)

### Documentation

We have a wide range of documentation on how to use Actual. This is all available in our [Community Documentation](https://actualbudget.org/docs/), including topics on [installing](https://actualbudget.org/docs/install/), [Budgeting](https://actualbudget.org/docs/budgeting/), [Account Management](https://actualbudget.org/docs/accounts/), [Tips & Tricks](https://actualbudget.org/docs/getting-started/tips-tricks) and some documentation for developers.

### Feature Requests

Current feature requests can be seen [here](https://github.com/actualbudget/actual/issues?q=is%3Aissue+label%3A%22needs+votes%22+sort%3Areactions-%2B1-desc). Vote for your favorite requests by reacting 👍 to the top comment of the request.

To add new feature requests, open a new Issue of the "Feature Request" type.
