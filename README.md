## General Instructions

This NestJS application can simply be deployed locally using the standard node deployment process.

For this application, there is a server configuration required to access the data sources. At this moment, it is done using the .env file in the project main directory. create a file manually and configure the following properties in the created file. Please note that key must not be modified.

```bash
$ MONGO_SERVER=mongodb://mongo:27017
$ MONGO_DB=bimsim
$ PORT=8090
$ RDF_SERVER=http://graphdb:7200/repositories/wilson-bimsim
$ SQL_DB_NAME=pdh
$ SQL_DB_URL=postgres://postgres:password@postgres:5432/pdh
$ MONGO_DB_FOR_TOOLS=pdh-tools
$ MONGO_SERVER_FOR_TOOLS=mongodb://mongo:27017
$ GRAPHDB_MAPPING_GRAPH=http://ams.validation/graph/mapping-layer
$ FILE_STORAGE_ROOT=/data/pdh-files
$ WEATHER_API_BASE_URL=https://api.example-weather-provider.com
$ WEATHER_API_KEY=changeme
$ WEATHER_API_TIMEOUT_MS=5000
$ WEATHER_API_AUTH_TYPE=apiKey
$ WEATHER_API_KEY_HEADER=x-api-key
```

See `.env.example` for a ready-to-copy template.

## Source Adapters

In addition to the MongoDB (`/sensors`), RDF/GraphDB (`/rdf`), and asset composition (`/assets`) endpoints, the PDH exposes two generic, reusable source-adapter patterns so that consuming applications never need to integrate directly with heterogeneous backends:

### Files / Object Adapter (`/files`)

Serves binary information objects (images, PDFs, CSVs, IFC files, point clouds such as `.las`/`.laz`/`.e57`, ...) without assuming their contents can or should be converted to JSON. Content is streamed rather than loaded fully into memory, and access is restricted to a single configurable storage root (`FILE_STORAGE_ROOT`), with protection against path traversal.

| Endpoint | Description |
| --- | --- |
| `GET /files` | List all files with metadata |
| `GET /files/:id` | Get metadata for one file (alias of `/files/:id/metadata`) |
| `GET /files/:id/metadata` | Get metadata for one file |
| `GET /files/:id/content` | Stream/download the binary file content |

The storage backend is abstracted behind a `FileSourceAdapter` interface (`src/modules/files/interfaces/file-source-adapter.interface.ts`). Only the local filesystem backend (`LocalFileSourceAdapter`) is implemented today; a future S3/MinIO or point-cloud repository backend can be substituted by implementing the same interface and changing a single provider binding in `files.module.ts` - no controller or consumer changes required.

### External HTTP API Adapter (`/external/*`)

Lets the PDH call preconfigured external HTTP APIs on demand, without becoming a generic proxy. External sources (base URL, authentication, allowed operations/endpoints) are declared in configuration/environment variables only - there is no endpoint that accepts an arbitrary URL.

| Endpoint | Description |
| --- | --- |
| `GET /external/weather/current` | Example domain endpoint demonstrating the pattern |
| `GET /external/sources/status` | Reachability status of all configured external sources |
| `GET /external/sources/:name/status` | Reachability status of one configured external source |

The reusable adapter (`HttpSourceAdapterService`, `src/modules/external/adapters/http-source-adapter.service.ts`) supports `none`, `apiKey` (HTTP header), and `bearer` (HTTP header) authentication, injects credentials from environment variables server-side, applies a configurable timeout, and never leaks secrets, base URLs, or upstream response bodies in errors or Swagger docs. Adding a new external source (FM API, ERP, GIS, ...) only requires adding an entry to `src/modules/external/config/external-sources.config.ts` plus its environment variables - existing consumers of other sources are unaffected.

##

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
