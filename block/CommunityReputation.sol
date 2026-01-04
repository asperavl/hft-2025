// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract CommunityReputation {

    address public admin;
    mapping(address => bool) public organizers;
    mapping(address => uint256) private reputation;

    enum ActionType { ATTENDED, VOLUNTEERED, DELIVERED_AID }
    mapping(ActionType => uint256) public actionPoints;

    event ReputationAdded(
        address indexed user,
        ActionType action,
        uint256 points,
        address indexed organizer
    );

    constructor() {
        admin = msg.sender;
        organizers[msg.sender] = true;

        actionPoints[ActionType.ATTENDED] = 5;
        actionPoints[ActionType.VOLUNTEERED] = 10;
        actionPoints[ActionType.DELIVERED_AID] = 15;
    }

    modifier onlyOrganizer() {
        require(organizers[msg.sender], "Not organizer");
        _;
    }

    function addOrganizer(address org) external {
        require(msg.sender == admin, "Only admin");
        organizers[org] = true;
    }

    function addReputation(address user, ActionType action)
        external
        onlyOrganizer
    {
        uint256 pts = actionPoints[action];
        reputation[user] += pts;
        emit ReputationAdded(user, action, pts, msg.sender);
    }

    function getReputation(address user)
        external
        view
        returns (uint256)
    {
        return reputation[user];
    }
}
