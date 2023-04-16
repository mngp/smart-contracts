// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

contract Timestamp {
    constructor() {

    }

    function getTimestamp() public view returns (uint) {
        return block.timestamp;
    }
}
