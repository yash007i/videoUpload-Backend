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
    if (!playlistId || !isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist ID");
      }
    
      const playlistById = await Playlist.aggregate([
        //match the owner's all playlists
        {
          $match: {
            _id: mongoose.Types.ObjectId(playlistId),
          },
        },
        // lookup for getting owner's details
        {
          $lookup: {
            from: "users",
            localField: "owner",
            foreignField: "_id",
            as: "createdBy",
            pipeline: [
              // projecting user details
              {
                $project: {
                  username: 1,
                  fullname: 1,
                  avatar: 1,
                },
              },
            ],
          },
        },
        // converting the createdBy array to an object
        {
          $addFields: {
            createdBy: {
              $arrayElemAt: ["$createdBy", 0],
            },
          },
        },
        // this lookup if for videos
        {
          $lookup: {
            from: "videos",
            localField: "videos",
            foreignField: "_id",
            as: "videos",
            pipeline: [
              // further lookup to get the owner details of the video
              {
                $lookup: {
                  from: "users",
                  localField: "owner",
                  foreignField: "_id",
                  as: "owner",
                  pipeline: [
                    {
                      $project: {
                        username: 1,
                        fullname: 1,
                        avatar: 1,
                      },
                    },
                  ],
                },
              },
              {
                $addFields: {
                  owner: {
                    $arrayElemAt: ["$owner", 0],
                  },
                },
              }, 
            ],
          },
        },
        // this projection is outside at the playlist level for the final result
        {
          $project: {
            videos: 1,
            createdBy: 1,
            name: 1,
            description: 1,
          },
        },
      ]);
    
      if (!playlistById) {
        throw new ApiError(400, "No playlist found");
      }
    
      return res
        .status(200)
        .json(new ApiResponse(200, playlistById, "playlist fetched successfully"));
})

const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, videoId } = req.params

    if(!playlistId || !isValidObjectId(playlistId)){
        throw new ApiError(400 , "Invalid playlist ID")
    }

    if(!videoId || !isValidObjectId(videoId)){
        throw new ApiError(400 , "Invalid video ID")
    }

    const playlist = await Playlist.findOne(playlistId)

    if(!playlist){
        throw new ApiError(400 , "Playlist not found")
    }

    if(!playlist.owner.equals(req.user?._id)){
        throw new ApiError(401, "You are not allowed to update this playlist")
    }

    if(!playlist.videos.includes(videoId)){
        throw new ApiError(400, "Video already exists in this Playlist");
    }

    const updatePlaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $push : {
                videos : videoId, 
            }
        },
        {
            new : true
        }
    )

    if(!updatePlaylist){
        throw new ApiError(400, "Error occur while adding video to playlist")
    }

    return res.status(200)
    .json(
        new ApiResponse(
            200,
            updatePlaylist,
            "Video add successfully in this playlist"
        )
    )
})

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, videoId } = req.params
    // TODO: remove video from playlist
    if(!playlistId || !isValidObjectId(playlistId)){
        throw new ApiError(400 , "Invalid playlist ID")
    }

    if(!videoId || !isValidObjectId(videoId)){
        throw new ApiError(400 , "Invalid video ID")
    }

    const playlist = await Playlist.findOne(playlistId)

    if(!playlist){
        throw new ApiError(400 , "Playlist not found")
    }

    if(!playlist.owner.equals(req.user?._id)){
        throw new ApiError(401, "You are not allowed to update this playlist")
    }

    if(!playlist.videos.includes(videoId)){
        throw new ApiError(400, "Video does not exists in this Playlist");
    }

    const updatePlaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $pull : {
                videos : videoId, 
            }
        },
        {
            new : true
        }
    )

    if(!updatePlaylist){
        throw new ApiError(400, "Error occur while removing video to playlist")
    }

    return res.status(200)
    .json(
        new ApiResponse(
            200,
            updatePlaylist,
            "Video removed successfully in this playlist"
        )
    )
})

const deletePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params
    // TODO: delete playlist
    if (!playlistId || !isValidObjectId(playlistId)) {
        throw new ApiError(400, "Missing or Invalid playlist ID");
      }
    
      const playlist = await Playlist.findById(playlistId);
    
      if (!playlist) {
        throw new ApiError(400, "No playlist found with this ID");
      }
    
      if (!playlist.owner.equals(req.user._id)) {
        throw new ApiError(403, "You are not allowed to delete this playlist");
      }
    
      const deletePlaylist = await Playlist.findByIdAndDelete(playlist._id);
    
      if (!deletePlaylist) {
        throw new ApiError(400, "Error while deleting this playlist");
      }
    
      return res.status(200).json(new ApiResponse(200, {}, "Playlist Deleted"));
})

const updatePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params
    const { name, description } = req.body
    //TODO: update playlist
    if (!playlistId || !isValidObjectId(playlistId)) {
        throw new ApiError(400, "Missing or Invalid playlist ID");
    }
    
    if (!(name || description)) {
        throw new ApiError(400, "All the fields are required");
    }

    const playlist = await Playlist.findById(playlistId);

    if (!playlist) {
        throw new ApiError(400, "No playlist found with this ID");
    }

    if (!playlist.owner.equals(req.user._id)) {
        throw new ApiError(403, "You are not allowed to update this playlist");
    }

    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $set: {
                name,
                description,
            },
        },
        { new: true }
    );
    
    if (!updatedPlaylist) {
        throw new ApiError(400, "Error while updating this playlist");
    }
    
    return res
        .status(200)
        .json(new ApiResponse(200, updatedPlaylist, "Playlist updated"));
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