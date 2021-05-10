/*
Copyright 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React, {useMemo, useState, useEffect} from "react";
import classnames from "classnames";
import {MatrixEvent} from "matrix-js-sdk/src/models/event";
import {Room} from "matrix-js-sdk/src/models/room";
import {MatrixClient} from "matrix-js-sdk/src/client";

import {_t} from "../../../languageHandler";
import SettingsStore from "../../../settings/SettingsStore";
import {UIFeature} from "../../../settings/UIFeature";
import {Layout} from "../../../settings/Layout";
import {IDialogProps} from "./IDialogProps";
import BaseDialog from "./BaseDialog";
import {avatarUrlForUser} from "../../../Avatar";
import EventTile from "../rooms/EventTile";
import SearchBox from "../../structures/SearchBox";
import RoomAvatar from "../avatars/RoomAvatar";
import AccessibleButton from "../elements/AccessibleButton";
import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";
import AutoHideScrollbar from "../../structures/AutoHideScrollbar";
import DMRoomMap from "../../../utils/DMRoomMap";
import {RoomPermalinkCreator} from "../../../utils/permalinks/Permalinks";
import {sortRooms} from "../../../stores/room-list/algorithms/tag-sorting/RecentAlgorithm";

const AVATAR_SIZE = 30;

interface IProps extends IDialogProps {
    cli: MatrixClient;
    // The event to forward
    event: MatrixEvent;
    // We need a permalink creator for the source room to pass through to EventTile
    // in case the event is a reply (even though the user can't get at the link)
    permalinkCreator: RoomPermalinkCreator;
}

interface IEntryProps {
    room: Room;
    // Callback to forward the message to this room
    send(): Promise<void>;
}

enum SendState {
    CanSend,
    Sending,
    Sent,
    Failed,
}

const Entry: React.FC<IEntryProps> = ({ room, send }) => {
    const [sendState, setSendState] = useState<SendState>(SendState.CanSend);

    let button;
    if (room.maySendMessage()) {
        let label;
        let className;
        if (sendState === SendState.CanSend) {
            label = _t("Send");
            className = "mx_ForwardList_canSend";
        } else if (sendState === SendState.Sending) {
            label = _t("Sending…");
            className = "mx_ForwardList_sending";
        } else if (sendState === SendState.Sent) {
            label = _t("Sent");
            className = "mx_ForwardList_sent";
        } else {
            label = _t("Failed to send");
            className = "mx_ForwardList_sendFailed";
        }

        button =
            <AccessibleButton
                kind={sendState === SendState.Failed ? "danger_outline" : "primary_outline"}
                className={className}
                onClick={async () => {
                    setSendState(SendState.Sending);
                    try {
                        await send();
                        setSendState(SendState.Sent);
                    } catch (e) {
                        setSendState(SendState.Failed);
                    }
                }}
                disabled={sendState !== SendState.CanSend}
            >
                { label }
            </AccessibleButton>;
    } else {
        button =
            <AccessibleTooltipButton
                kind="primary_outline"
                className={"mx_ForwardList_canSend"}
                onClick={() => {}}
                disabled={true}
                title={_t("You do not have permission to post to this room")}
            >
                { _t("Send") }
            </AccessibleTooltipButton>;
    }

    return <div className="mx_ForwardList_entry">
        <RoomAvatar room={room} height={32} width={32} />
        <span className="mx_ForwardList_entry_name">{ room.name }</span>
        { button }
    </div>;
};

const ForwardDialog: React.FC<IProps> = ({ cli, event, permalinkCreator, onFinished }) => {
    const userId = cli.getUserId();
    const [profileInfo, setProfileInfo] = useState<any>({});
    useEffect(() => {
        cli.getProfileInfo(userId).then(info => setProfileInfo(info));
    }, [cli, userId]);

    // For the message preview we fake the sender as ourselves
    const mockEvent = new MatrixEvent({
        type: "m.room.message",
        sender: userId,
        content: event.getContent(),
        unsigned: {
            age: 97,
        },
        event_id: "$9999999999999999999999999999999999999999999",
        room_id: event.getRoomId(),
    });
    mockEvent.sender = {
        name: profileInfo.displayname || userId,
        userId,
        getAvatarUrl: (..._) => {
            return avatarUrlForUser(
                { avatarUrl: profileInfo.avatar_url },
                AVATAR_SIZE, AVATAR_SIZE, "crop",
            );
        },
        getMxcAvatarUrl: () => profileInfo.avatar_url,
    };

    const visibleRooms = useMemo(() => sortRooms(
        cli.getVisibleRooms().filter(
            room => room.getMyMembership() === "join" &&
                !(SettingsStore.getValue("feature_spaces") && room.isSpaceRoom()),
        ),
    ), [cli]);

    const [query, setQuery] = useState("");
    const lcQuery = query.toLowerCase();

    const [rooms, dms] = visibleRooms.reduce((arr, room) => {
        if (room.name.toLowerCase().includes(lcQuery)) {
            if (DMRoomMap.shared().getUserIdForRoomId(room.roomId)) {
                arr[1].push(room);
            } else {
                arr[0].push(room);
            }
        }
        return arr;
    }, [[], []]);

    const previewLayout = SettingsStore.getValue("layout");

    return <BaseDialog
        title={ _t("Forward message") }
        className="mx_ForwardDialog"
        contentId="mx_ForwardList"
        onFinished={onFinished}
        fixedWidth={false}
    >
        <div className={classnames("mx_ForwardDialog_preview", {
            "mx_IRCLayout": previewLayout == Layout.IRC,
            "mx_GroupLayout": previewLayout == Layout.Group,
        })}>
            <EventTile
                mxEvent={mockEvent}
                layout={previewLayout}
                enableFlair={SettingsStore.getValue(UIFeature.Flair)}
                permalinkCreator={permalinkCreator}
            />
        </div>
        <div className="mx_ForwardList">
            <h2>{ _t("Forward to") }</h2>
            <SearchBox
                className="mx_textinput_icon mx_textinput_search"
                placeholder={ _t("Filter your rooms and DMs") }
                onSearch={setQuery}
                autoComplete={true}
                autoFocus={true}
            />
            <AutoHideScrollbar className="mx_ForwardList_content" id="mx_ForwardList">
                { rooms.length > 0 ? (
                    <div className="mx_ForwardList_section">
                        <h3>{ _t("Rooms") }</h3>
                        { rooms.map(room =>
                            <Entry
                                key={room.roomId}
                                room={room}
                                send={() => cli.sendEvent(room.roomId, event.getType(), event.getContent())}
                            />,
                        ) }
                    </div>
                ) : undefined }

                { dms.length > 0 ? (
                    <div className="mx_ForwardList_section">
                        <h3>{ _t("Direct Messages") }</h3>
                        { dms.map(room =>
                            <Entry
                                key={room.roomId}
                                room={room}
                                send={() => cli.sendEvent(room.roomId, event.getType(), event.getContent())}
                            />,
                        ) }
                    </div>
                ) : undefined }

                { rooms.length + dms.length < 1 ? <span className="mx_ForwardList_noResults">
                    { _t("No results") }
                </span> : undefined }
            </AutoHideScrollbar>
        </div>
    </BaseDialog>;
};

export default ForwardDialog;
