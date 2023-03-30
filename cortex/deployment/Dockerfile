FROM {{{imageServer}}}/{{{imageProject}}}/nodejs:{{{nodeJsVersion}}}

# install build tools and runtimes (also those required by the sandbox -------------------------------------------------

WORKDIR /usr/local/src

RUN apt-get update && \
    apt-get install -y --no-install-recommends --no-install-suggests imagemagick graphicsmagick cmake git && \
    wget -O zmq.tgz https://github.com/zeromq/libzmq/releases/download/v4.2.5/zeromq-4.2.5.tar.gz && \
    tar zxf zmq.tgz && \
    cd zeromq-4.2.5/ && \
    ./configure --with-poller=epoll && \
    make && \
    make install && \
    ldconfig

# copy and build sandbox  ----------------------------------------------------------------------------------------------

WORKDIR /app/sandbox

COPY .deployment/repo/sandbox .

RUN npm ci --production && \
    node ./build -clean && \
    node ./build -release

# install app ----------------------------------------------------------------------------------------------------------

WORKDIR /app

COPY .deployment/repo .

RUN --mount=type=ssh,id=default,required=true \
    mkdir -p -m 0600 ~/.ssh && \
    ssh-keyscan github.com >> ~/.ssh/known_hosts && \
    ssh-keyscan gitlab.medable.com >> ~/.ssh/known_hosts && \
    npm ci --only=production
    # @todo automate npm audit fix within CI/CD and automatically
    # tag and build a new version if dependency updates are required.
    # Execute tests on all builds.
    # Until this automation is in place, we need to manually run `npm audit fix`
    # before each release, and commit any changes.
    #
    # npm audit fix

# build runtime sandbox scripts ----------------------------------------------------------------------------------------

WORKDIR /app/lib/modules/sandbox/scripts

RUN node ./build

# cleanup and run ------------------------------------------------------------------------------------------------------

WORKDIR /app

RUN rm -rf ci deployment test

CMD ["node", "--max-old-space-size=4096", "./main.js"]