import mongoose, { isValidObjectId } from "mongoose"
import { Playlist } from "../models/playlist.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"


const createPlaylist = asyncHandler(async (req, res) => {
    const { name, description } = req.body

    //TODO: create playlist

    if (!name || !description) {
        throw new ApiError(400, "Both playlist name and description are required");
    }

    const existingPlaylist = await Playlist.findOne({
        name,
        owner: req.user?._id,
    });

    if(!existingPlaylist){
        throw new ApiError(400, "Playlist is already exists with this name.")
    }

    const playList = await Playlist.create({
        name,
        description,
        owner : req.user?._id
    })

    if(!playList){
        throw new ApiError(400 , "Error occuring while creating playlist")
    }

    return res.status(200)
    .json(
        new ApiResponse(
            200,
            playList,
            "Playlist created successfully"
        )
    )
})

const getUserPlaylists = asyncHandler(async (req, res) => {
    const { userId } = req.params
    //TODO: get user playlists

    if (!userId || !isValidObjectId(userId)) {
        throw new ApiError(400, "No user ID or Invalid user ID");
    }

    const userPlaylist = await Playlist.aggregate(
        [
            {
                $match : {
                    owner : new mongoose.Types.ObjectId(userId)
                },
            },
            {
                $lookup : {
                    from : "users",
                    localField : "owner",
                    foreignField : "_id",
                    as : "createdBy",
                    pipeline : [
                        {
                            $project : {
                                username : 1,
                                fullName : 1,
                                avatar : 1
                            }
                        }
                    ]
                }
            },
            { 
                $addFields: {
                    createdBy: {
                      $arrayElemAt: ["$createdBy", 0],
                    },
                },
            },
            {
                $lookup : {
                    from : "videos",
                    localField : "videos",
                    foreignField : "_id",
                    as : "videos",
                    pipeline : [
                        {
                            $lookup : {
                                from : "users",
                                localField : "owner",
                                foreignField : "_id",
                                as : "owner",
                                pipeline : [
                                    {
                                        $project :{
                                            username : 1,
                                            fullName : 1,
                                            avatar : 1,
                                        }
                                    }
                                ]
                            }
                        },
                        {
                            $addFields: {
                                owner: {
                                  $arrayElemAt: ["$owner", 0],
                                },
                            },
                        },
                        {
                            $project: {
                                title: 1,
                                description: 1,
                                thumbnail: 1,
                                owner: 1,
                            }   
                        }
                    ]
                }
            },
            {
                $project: {
                  videos: 1,
                  createdBy: 1,
                  name: 1,
                  description: 1,
                },
            },
        ]
    )

    if(!userPlaylist || userPlaylist.length === 0){
        throw new ApiError(404, "Playlist not found")
    }

    return res.status(200)
    .json(
        new ApiResponse(
            200,
            userPlaylist,
            "Playlist fetched"
        )
    )

})

const getPlaylistById = asyncHandler(async (req, res) => {
    const { playlistId } = req.params
    //TODO: get playlist by id
})

const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, videoId } = req.params
})

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, videoId } = req.params
    // TODO: remove video from playlist

})

const deletePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params
    // TODO: delete playlist
})

const updatePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params
    const { name, description } = req.body
    //TODO: update playlist
})

export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
}