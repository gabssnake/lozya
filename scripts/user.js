﻿"use strict";

const POSITION_REQUEST_DEBOUNCE_TIME = 1000,
    STACKED_USER_OFFSET_X = 5,
    STACKED_USER_OFFSET_Y = 5;

class User {
    constructor(id, displayName, isMe) {
        this.id = id;
        this.displayName = displayName || id;
        this.x = 0; this.y = 0;
        this.sx = 0; this.sy = 0;
        this.tx = 0; this.ty = 0;
        this.dx = 0; this.dy = 0;
        this.dist = 0;
        this.t = 0;
        this.distToMe = 0;
        this.isMe = isMe;
        this.stackUserCount = 1;
        this.stackIndex = 0;
        this.stackAvatarHeight = 0;
        this.stackAvatarWidth = 0;
        this.stackOffsetX = 0;
        this.stackOffsetY = 0;
        this.hasPosition = isMe;
        this.lastPositionRequestTime = Date.now() - POSITION_REQUEST_DEBOUNCE_TIME;
        this.lastMove = MOVE_REPEAT;
    }

    moveBy(dx, dy) {
        this.moveTo(this.tx + dx, this.ty + dy);
    }

    moveTo(x, y) {
        if (this.isMe) {
            for (let user of userList) {
                if (!user.isMe) {
                    jitsiClient.txGameData(user.id, "moveTo", {
                        x: x,
                        y: y
                    });
                }
            }
        }
        else if (!this.hasPosition) {
            this.hasPosition = true;
            this.x = x;
            this.y = y;
        }

        this.sx = this.x;
        this.sy = this.y;
        this.tx = x;
        this.ty = y;
        this.dx = this.tx - this.sx;
        this.dy = this.ty - this.sy;
        this.dist = Math.sqrt(this.dx * this.dx + this.dy * this.dy);
        this.t = 0;
    }

    readUser(user) {
        if (this.isMe
            && !user.isMe) {
            const dx = user.tx - this.tx,
                dy = user.ty - this.ty,
                distSq = dx * dx + dy * dy,
                dist = clamp(Math.sqrt(distSq), AUDIO_DISTANCE_MIN, AUDIO_DISTANCE_MAX);

            if (dist !== user.distToMe) {
                user.distToMe = dist;
                const volume = 1 - project(dist, AUDIO_DISTANCE_MIN, AUDIO_DISTANCE_MAX);

                jitsiClient.txJitsiHax("setVolume", {
                    user: user.id,
                    volume: volume
                });
            }
        }
    }

    readInput(dt, keys) {
        if (this.isMe) {
            this.lastMove += dt;
            if (this.lastMove >= MOVE_REPEAT) {
                let dx = 0,
                    dy = 0;

                for (let key of keys) {
                    switch (key) {
                        case "ArrowUp": dy--; break;
                        case "ArrowDown": dy++; break;
                        case "ArrowLeft": dx--; break;
                        case "ArrowRight": dx++; break;
                    }
                }

                if (dx !== 0
                    || dy !== 0) {
                    this.moveBy(dx, dy);
                }

                this.lastMove = 0;
            }
        }
        else if (!this.hasPosition) {
            const now = Date.now(),
                dt = now - this.lastPositionRequestTime;
            if (dt >= POSITION_REQUEST_DEBOUNCE_TIME) {
                this.lastPositionRequestTime = now;
                jitsiClient.txGameData(this.id, "userInitResponse");
            }
        }
    }

    update(dt, userList) {
        if (this.hasPosition) {
            if (this.dist > 0) {
                this.t += dt;
                if (this.t >= MOVE_TRANSITION_TIME) {
                    this.x = this.sx = this.tx;
                    this.y = this.sy = this.ty;
                    this.t = this.dx = this.dy = this.dist = 0;
                }
                else {
                    const p = this.t / MOVE_TRANSITION_TIME,
                        s = Math.sin(Math.PI * p / 2);
                    this.x = this.sx + s * this.dx;
                    this.y = this.sy + s * this.dy;
                }
            }

            this.stackUserCount = 0;
            this.stackIndex = 0;
            for (let user of userList) {
                if (user.hasPosition
                    && user.tx === this.tx
                    && user.ty === this.ty) {
                    if (user.id === this.id) {
                        this.stackIndex = this.stackUserCount;
                    }
                    ++this.stackUserCount;
                }
            }

            this.stackAvatarWidth = map.tileWidth - (this.stackUserCount - 1) * STACKED_USER_OFFSET_X;
            this.stackAvatarHeight = map.tileHeight - (this.stackUserCount - 1) * STACKED_USER_OFFSET_Y;
            this.stackOffsetX = this.stackIndex * STACKED_USER_OFFSET_X;
            this.stackOffsetY = this.stackIndex * STACKED_USER_OFFSET_Y;
        }
    }

    drawShadow(g, map) {
        if (this.hasPosition) {
            g.save();
            {
                g.translate(this.tx * map.tileWidth + this.stackOffsetX, this.ty * map.tileHeight + this.stackOffsetY);
                g.shadowColor = "rgba(0, 0, 0, 0.5)";
                g.shadowOffsetX = 3 * cameraZ;
                g.shadowOffsetY = 3 * cameraZ;
                g.shadowBlur = 3 * cameraZ;

                g.fillStyle = "black";
                g.fillRect(
                    (this.x - this.tx) * map.tileWidth,
                    (this.y - this.ty) * map.tileHeight,
                    this.stackAvatarWidth,
                    this.stackAvatarHeight);
            }
            g.restore();
        }
    }

    drawAvatar(g, map) {
        if (this.hasPosition) {
            g.save();
            {
                g.translate(this.tx * map.tileWidth + this.stackOffsetX, this.ty * map.tileHeight + this.stackOffsetY);

                g.fillStyle = this.isMe ? "red" : "blue";
                g.fillRect(
                    (this.x - this.tx) * map.tileWidth,
                    (this.y - this.ty) * map.tileHeight,
                    this.stackAvatarWidth,
                    this.stackAvatarHeight);

                g.strokeStyle = "grey";
                g.strokeRect(0, 0, this.stackAvatarWidth, this.stackAvatarHeight);
            }
            g.restore();
        }
    }

    drawName(g, map) {
        if (this.hasPosition) {

            g.save();
            {
                g.translate(this.tx * map.tileWidth + this.stackOffsetX, this.ty * map.tileHeight + this.stackOffsetY);
                g.shadowColor = "black";
                g.shadowOffsetX = 3 * cameraZ;
                g.shadowOffsetY = 3 * cameraZ;
                g.shadowBlur = 3 * cameraZ;

                g.fillStyle = "white";
                g.textBaseline = "bottom";
                g.fillText(this.displayName, 0, 0);
            }
            g.restore();
        }
    }
}