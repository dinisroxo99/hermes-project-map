ARG DOTNET_VERSION=10.0

FROM mcr.microsoft.com/dotnet/sdk:${DOTNET_VERSION}

RUN apt-get update \
    && apt-get install -y curl bash git \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get update \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

RUN dotnet tool install --tool-path /usr/local/bin scip-dotnet

ENV PATH="${PATH}:/usr/local/bin"

WORKDIR /app

COPY package.json package-lock*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

COPY src ./src

RUN mkdir -p src/public/vendor \
    && cp node_modules/cytoscape/dist/cytoscape.min.js src/public/vendor/cytoscape.min.js \
    && cp node_modules/3d-force-graph/dist/3d-force-graph.min.js src/public/vendor/3d-force-graph.min.js

RUN useradd --create-home --shell /usr/sbin/nologin appuser \
    && mkdir -p /app/data \
    && chown -R appuser:appuser /app

EXPOSE 8770

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8770/api/health || exit 1

USER appuser

CMD ["node", "src/server.js"]