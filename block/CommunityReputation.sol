// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract CommunityReputation {

    address public admin;
    mapping(address => bool) public organizers;
    mapping(address => uint256) private reputation;

    // ✨ GENERIC EVENT: Stores the Context (Strings), not just IDs
    event ReputationAdded(
        address indexed user,
        string communityId,
        string schemaId,
        string actionId,
        uint256 basePoints,
        uint256 bonusPoints,
        uint256 totalPoints,
        address indexed organizer,
        uint256 timestamp
    );

    constructor() {
        admin = msg.sender;
        organizers[msg.sender] = true;
    }

    modifier onlyOrganizer() {
        require(organizers[msg.sender], "Not organizer");
        _;
    }

    function addOrganizer(address org) external {
        require(msg.sender == admin, "Only admin");
        organizers[org] = true;
    }

    // ✨ THE "DUMB" RECORD FUNCTION
    // No checks. No lookups. Just record what the Schema Registry told us.
    function addReputation(
        address user, 
        string memory communityId,
        string memory schemaId,
        string memory actionId,
        uint256 basePoints,
        uint256 bonusPoints
    )
        external
        onlyOrganizer
    {
        uint256 total = basePoints + bonusPoints;
        reputation[user] += total;
        
        emit ReputationAdded(
            user, 
            communityId, 
            schemaId, 
            actionId, 
            basePoints, 
            bonusPoints, 
            total, 
            msg.sender, 
            block.timestamp
        );
    }

    function getReputation(address user) external view returns (uint256) {
        return reputation[user];
    }
}