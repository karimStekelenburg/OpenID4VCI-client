<h1 align="center">
  <br>
  <a href="https://www.sphereon.com"><img src="https://sphereon.com/content/themes/sphereon/assets/img/logo.svg" alt="Sphereon" width="400"></a>
    <br>OpenID for Verifiable Credential Issuance - Client 
  <br>
</h1>

[![CI](https://github.com/Sphereon-Opensource/oid4vci-client/actions/workflows/main.yml/badge.svg)](https://github.com/Sphereon-Opensource/oid4vci-client/actions/workflows/main.yml) [![codecov](https://codecov.io/gh/Sphereon-Opensource/oid4vci-client/branch/develop/graph/badge.svg)](https://codecov.io/gh/Sphereon-Opensource/pex) [![NPM Version](https://img.shields.io/npm/v/@sphereon/oid4vci-client.svg)](https://npm.im/@sphereon/oid4vci-client)


_IMPORTANT this package is in an early development stage and does not support all functionality from the OID4VCI spec
yet!_

### Background

A client to request and receive Verifiable Credentials using
the [OpenID for Verifiable Credential Issuance](https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html) (
OID4VCI) specification for receiving Verifiable Credentials as a Holder.

### Flows

#### Authorized Code Flow

This flow isn't supported yet!

#### Pre-authorized Code Flow

The pre-authorized code flow assumes the user is using an out of bound mechanism outside the issuance flow to
authenticate first.

The below diagram shows the steps involved in the pre-authorized code flow. Note that wallet inner functionalities (like
saving VCs) are out of scope for this library. Also This library doesn't involve any functionalities of a VC Issuer
![Flow diagram](https://www.plantuml.com/plantuml/proxy?cache=no&src=https://raw.githubusercontent.com/Sphereon-Opensource/OID4VCI-client/develop/docs/preauthorized-code-flow.puml)

#### Issuance Initiation

Issuance is started from a so-called Issuance Initiation Request by the Issuer. This typically is URI, exposed
as a link or a QR code. You can call the `IssuanceInitiation.fromURI(uri)` method to parse the URI into a Json object
containing the baseUrl and the `IssuanceInitiationRequest` payload object

```typescript
import { IssuanceInitiation } from '@sphereon/oid4vci-client';

const initiationURI =
  'https://issuer.example.com?issuer=https%3A%2F%2Fserver%2Eexample%2Ecom&credential_type=https%3A%2F%2Fdid%2Eexample%2Eorg%2FhealthCard&credential_type=https%3A%2F%2Fdid%2Eexample%2Eorg%2FdriverLicense&op_state=eyJhbGciOiJSU0Et...FYUaBy';

const initiationRequestWithUrl = IssuanceInitiation.fromURI(initiationURI);
console.log(initiationRequestWithUrl);

/**
 * {
 *    "baseUrl": "https://server.example.com",
 *    "issuanceInitiationRequest": {
 *      "credential_type": [
 *        "https://did.example.org/healthCard",
 *        "https://did.example.org/driverLicense"
 *      ],
 *      "issuer": "https://server.example.com",
 *      "op_state": "eyJhbGciOiJSU0Et...FYUaBy"
 *    }
 * }
 */
```

#### Acquiring the Access Token

Now you will need to get an access token from the oAuth2 Authorization Server (AS), using some values from
the `IssuanceInitiationRequest` payload.
For now you can use the issuer hostname for the AS, as there is no way to know the AS from the Issuance Initiation for
known until the
following [OpenID Ticket](https://bitbucket.org/openid/connect/issues/1632/issuer-metadata-clarification-needed) is
resolved. So the token endpoint would become https://<issuer-hostname>/token.
The library allows to pass in a different value for the AS token endpoint as well, so you already can use a different AS
if you know the AS upfront. If no AS is provided the issuer value from the Issuance Initiation Request will be used.

````typescript
import { AccessTokenClient, AuthorizationServerOpts } from '@sphereon/oid4vci-client';

const clientId = "abcd" // This can be a random value or a clientId assigned by the Authorization Server (depends on the environment)
const pin = 1234 // A pincode which is shown out of band typically. Only use when the pin-code is required is set.

// Allows to override the Authorization Server and provide other AS options. By default the issuer value will be used
const asOpts: AuthorizationServerOpts = {
  as: "as.example.com"
}

const accessTokenResponse = AccessTokenClient.acquireAccessTokenUsingIssuanceInitiation(initiationRequestWithUrl, clientId, { pin, asOpts })
console.log(accessTokenResponse)
/**
 * {
 *      access_token: "eyJhbGciOiJSUzI1NiIsInR5cCI6Ikp..sHQ"
 *      token_type: "bearer",
 *      expires_in: 86400
 * }
 */

````

#### Asking for the Verifiable Credential to be issued

First of all we need to hook up a library that can sign JWTs. The library makes no assumptions as it will provide callbacks to perform the signature. In this example we will be using the jose library.

````typescript

const keyPair = await jose.generateKeyPair('ES256');
const privateKey = keyPair.privateKey
const publicKey = keyPair.publicKey

const signJWT = async (args: JWTSignerArgs): Promise<string> => {
  const { header, payload, privateKey } = args;
  return await new jose.CompactSign(u8a.fromString(JSON.stringify({ ...payload })))
    .setProtectedHeader({ ...header, alg: args.header.alg })
    .sign(privateKey);
};
````

The JWT Signer Interfaces:
````typescript
export type Alg = 'ES256' | 'EdDSA';

export interface JWTHeader {
  alg: Alg; // REQUIRED by the JWT signer
  typ?: string; //JWT always
  kid?: string; // CONDITIONAL. JWT header containing the key ID. If the Credential shall be bound to a DID, the kid refers to a DID URL which identifies a particular key in the DID Document that the Credential shall be bound to. MUST NOT be present if jwk or x5c is present.
  jwk?: JWK; // CONDITIONAL. JWT header containing the key material the new Credential shall be bound to. MUST NOT be present if kid or x5c is present.
  x5c?: string[]; // CONDITIONAL. JWT header containing a certificate or certificate chain corresponding to the key used to sign the JWT. This element may be used to convey a key attestation. In such a case, the actual key certificate will contain attributes related to the key properties. MUST NOT be present if kid or jwk is present.
}

export interface JWTPayload {
  iss: string; // REQUIRED (string). The value of this claim MUST be the client_id of the client making the credential request.
  aud?: string; // REQUIRED (string). The value of this claim MUST be the issuer URL of credential issuer.
  iat?: number; // REQUIRED (number). The value of this claim MUST be the time at which the proof was issued using the syntax defined in [RFC7519].
  nonce?: string; // REQUIRED (string). The value type of this claim MUST be a string, where the value is a c_nonce provided by the credential issuer. //TODO: Marked as required not present in NGI flow
  jti: string; // A new nonce chosen by the wallet. Used to prevent replay
  exp?: number; // Not longer than 5 minutes
}

export interface JWTSignerArgs {
  header: JWTHeader;
  payload: JWTPayload;
  privateKey: KeyObject;
  publicKey: KeyObject;
}

export interface ProofOfPossessionOpts {
  issuerURL?: string;
  clientId?: string;
  jwtSignerArgs: JWTSignerArgs;
  jwtSignerCallback: JWTSignerCallback;
  jwtVerifyCallback?: JWTVerifyCallback;
}

export type JWTSignerCallback = (args: JWTSignerArgs) => Promise<string>;

export type JWTVerifyCallback = (args: JWTVerifyArgs) => Promise<void>;
````

Now it is time to request the actual Credential(s) from the Issuer. The example uses a DID:JWK .The DID:JWK should match the keypair created earlier.

````typescript
import { CredentialRequestClientBuilder, CredentialResponse, ProofOfPossessionOpts } from './CredentialIssuance.types';

const credentialRequestClient = CredentialRequestClientBuilder.fromIssuanceInitiation(initiationRequestWithUrl)

const proofOpts: ProofOfPossessionOpts = {
  jwtSignerArgs: {
    header: {
      kid: 'did:jwk:example-did'
    },
    payload: {
      jti: 'random-nonce-provided-by-client'
    },
    privateKey,
    publicKey
  },
  jwtSignerCallback: (args) => signJWT(args)
}

// In 1 step:
const credentialResponse: CredentialResponse = await credentialRequestClient.acquireCredentialsUsingProof(proofOpts, { format: 'jwt_vc' }) // Allows us to override the format

// Or in 2 steps:
// const credentialRequest: CredentialRequest = await credentialRequestClient.createCredentialRequest(proofOpts, { format: 'jwt_vc' }) // Allows us to override the format
// const credentialResponse: CredentialResponse = await credentialRequestClient.acquireCredentialsUsingRequest(credentialRequest)
````

### Interfaces
Some important interfaces are described below:
```typescript
export interface IssuanceInitiationRequestPayload {
  issuer: string; //REQUIRED The issuer URL of the Credential issuer, the Wallet is requested to obtain one or more Credentials from.
  credential_type: string[] | string; //REQUIRED A JSON string denoting the type of the Credential the Wallet shall request
  pre_authorized_code?: string; //CONDITIONAL The code representing the issuer's authorization for the Wallet to obtain Credentials of a certain type. This code MUST be short lived and single-use. MUST be present in a pre-authorized code flow.
  user_pin_required?: boolean; //OPTIONAL Boolean value specifying whether the issuer expects presentation of a user PIN along with the Token Request in a pre-authorized code flow. Default is false.
  op_state?: string; //OPTIONAL String value created by the Credential Issuer and opaque to the Wallet that is used to bind the sub-sequent authentication request with the Credential Issuer to a context set up during previous steps
}

export interface CredentialRequest {
  type: string | string[];
  format: CredentialFormat | CredentialFormat[];
  proof: ProofOfPossession;
}

export interface CredentialResponse {
  credential: W3CVerifiableCredential;
  format: CredentialFormat;
}

export interface CredentialResponseError {
  error: CredentialResponseErrorCode;
  error_description?: string;
  error_uri?: string;
}
```

### Functions

Several utility functions are available

#### convertJsonToURI:

Converts a Json object or string into an URI:

```typescript
import { convertJsonToURI } from './Encoding';

const encodedURI = convertJsonToURI(
  {
    issuer: 'https://server.example.com',
    credential_type: ['https://did.example.org/healthCard', 'https://did.example1.org/driverLicense'],
    op_state: 'eyJhbGciOiJSU0Et...FYUaBy',
  },
  {
    arrayTypeProperties: ['credential_type'],
    urlTypeProperties: ['issuer', 'credential_type'],
  }
);
console.log(encodedURI);
// issuer=https%3A%2F%2Fserver%2Eexample%2Ecom&credential_type=https%3A%2F%2Fdid%2Eexample%2Eorg%2FhealthCard&credential_type=https%3A%2F%2Fdid%2Eexample%2Eorg%2FdriverLicense&op_state=eyJhbGciOiJSU0Et...FYUaBy
```

#### convertURIToJsonObject:

Converts a URI into a Json object with URL decoded properties. Allows to provide which potential duplicate keys need to
be converted into an array.

```typescript
import { convertURIToJsonObject } from './Encoding';

const decodedJson = convertURIToJsonObject(
  'issuer=https%3A%2F%2Fserver%2Eexample%2Ecom&credential_type=https%3A%2F%2Fdid%2Eexample%2Eorg%2FhealthCard&credential_type=https%3A%2F%2Fdid%2Eexample%2Eorg%2FdriverLicense&op_state=eyJhbGciOiJSU0Et...FYUaBy',
  {
    arrayTypeProperties: ['credential_type'],
    requiredProperties: ['issuer', 'credential_type'],
  }
);
console.log(decodedJson);
// {
//   issuer: 'https://server.example.com',
//   credential_type: ['https://did.example.org/healthCard', 'https://did.example1.org/driverLicense'],
//   op_state: 'eyJhbGciOiJSU0Et...FYUaBy'
// }
```

#### createProofOfPossession

Creates the ProofOfPossession object and JWT signature

The callback function created using the `jose` library.

```typescript
// Must be JWS
const signJWT = async (args: JWTSignerArgs): Promise<string> => {
  const { header, payload, keyPair } = args;
  return await new jose.CompactSign(u8a.fromString(JSON.stringify({ ...payload })))
    // Only ES256 and EdDSA are supported
    .setProtectedHeader({ ...header, alg: args.header.alg })
    .sign(keyPair.privateKey);
};
```

```typescript
const verifyJWT = async (args: { jws: string | Uint8Array; key: KeyLike | Uint8Array; options?: VerifyOptions }): Promise<void> => {
  // Throws an exception if JWT is not valid
  await jose.compactVerify(args.jws, args.key, args.options);
};
```

The arguments requested by `jose` and `oidc4vci`

```typescript
const keyPair = await jose.generateKeyPair('ES256');

const jwtArgs: JWTSignerArgs = {
  header: {
    alg: 'ES256',
    kid: 'did:example:ebfeb1f712ebc6f1c276e12ec21/keys/1',
  },
  payload: {
    iss: 's6BhdRkqt3',
    aud: 'https://server.example.com',
    iat: 1659145924,
    nonce: 'tZignsnFbp',
  },
  privateKey: keyPair.privateKey,
  publicKey: keyPair.publicKey,
};
```

The actual method call

```typescript
const proof: ProofOfPossession = await createProofOfPossession({
  jwtSignerArgs: jwtArgs,
  jwtSignerCallback: (args) => signJWT(args),
  jwtVerifyCallback: (args) => verifyJWT(args),
});
console.log(proof);
// {
//   "proof_type": "jwt",
//     "jwt": "eyJhbGciOiJSUzI1NiIsImtpZCI6ImRpZDpleGFtcGxlOmViZmViMWY3MTJlYmM2ZjFjMjc2ZTEyZWMyMS9rZXlzLzEifQ.eyJpc3MiOiJzNkJoZFJrcXQzIiwiYXVkIjoiaHR0cHM6Ly9zZXJ2ZXIuZXhhbXBsZS5jb20iLCJpYXQiOjE2NTkxNDU5MjQsIm5vbmNlIjoidFppZ25zbkZicCJ9.btetOcsJ_VOePkwlFf2kyxm6hEUvPRimf3M-Dn3Lmzcmt5QiPToXNWxe_0fEJlRf4Ith55YGB43ScBe6ScZmD1gfLELYQF7LLg97yYlx_Iu8RLA2dS_7EWzLD3ZIzyUGf_uMq3HwXGJKL-ihroRpRBvxRLdZCy-j62nAzoTsBnlr6n79VjkGtlxIjN_CLGIQBhc3du3enghY6N4s3oXFrxWMl7UzGKdjCYN6vSagDb0MURjdiDCsK_yX4NyNd0nGpxqGhVgMpuhqEcqyU0qWPyHF-swtGG5JVAOJGd_YkJS5vbia8UdyOJXnAAdEE1E62a2yUPahNDxMh1iIpS0WO7y6QexWXdb5fmnWDst89T3ELS8Hj2Vzsw1XPyk9XR9JmiDzmEZdH05Wf4M9pXUG4-8_7StB6Lxc7_xDJdk6JPbzFgAIhJa4F_3rfPuwMseSEQvD6bDFowkIiUpt1vXGGVjVm3N4I4Th4_A2QpW4mDzcTKoZq9MKlDGXeLQBtiKXmqs10Jvzpp3O7kBwH7Qm6VUdBxk_-wsWplUZC4IvCfv23hy2SyFnh5zC6Wtw3UcbrSH6LcD7g-RNTKe4fRekyDxqLRdEm60BOozgBoTNhnetCrQ3e7HrApj9EP0vqNyXdtGGWCA011HVDnz6lVzf5yijJB8hOPpkgYGRmHdRQwI"
// }
```
