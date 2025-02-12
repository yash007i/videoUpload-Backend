import {asyncHandler} from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import {User} from "../models/user.models.js"
import { uploadOnCloudinary } from "../utils/fileUpload.servies.js"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken =  user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave : false })

        return { accessToken, refreshToken }

    } catch (error) {
        throw new ApiError(500, "Something went wrong, while generated tokens")
    }
}


const registerUser = asyncHandler( async (req,res) => {
    // Step to follow
    // get the user data from frontend
    // validation - not empty
    // check if user already exists : email, username
    // check for image, check for avatar
    // upload them to coludinary , avatar
    // create user object - create entry in DB  
    // remove password and refresh token filed from response
    // check for user creation
    // return response 

    const {fullName, email, username, password} = req.body
    console.log(req.body);
    
    if(
        [fullName, email, username, password].some((field) => 
        field?.trim() === "" )
    ){
        throw new ApiError(400, "All fields are required");        
    }

    const existedUser = await User.findOne({
        $or : [{ username }, { email }]
    })

    if(existedUser){
        throw new ApiError(409, "User is alredy exist with this email or username")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path    
    const coverImageLocalPath = req.files?.coverImage[0]?.path

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar must required")
    }
    console.log(coverImageLocalPath);
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    
    
    if(!avatar){
        throw new ApiError(400, "Avatar file is required")
    }

    const user = await User.create({
        fullName,
        avatar : avatar.url,
        coverImage : coverImage.url || "",
        email,
        password,
        username : username.toLowerCase()
    })
    
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500, "Something went wrong, while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User rigister successfully")
    )

})

const loginUser = asyncHandler( async (req,res) => {
    // Follow below step

    // req body -> data
    // username or email
    // find the user
    // password check
    // access token and refresh token generated
    // send a securely cookie
    // send response

    const {username, email, password} = req.body

    if(!(username || email)){
        throw new ApiError(400, "Username or Email is required")
    }

    const user = await User.findOne({
        $or : [{username}, {email}]
    })

    if(!user){
        throw new ApiError(404, "User does not exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401, "Password is invalid")
    }

    const { accessToken, refreshToken } =  await generateAccessAndRefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true, 
        secure:  true
    }// modified by server only , not in frontend. Bydefault modifiable througth frontend.

    return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(200, 
            {
                user: loggedInUser, accessToken, refreshToken // user save it self token in mobile app devlopnment
            },
            "User logged in successfully"
        )
    )

})

const logoutUser = asyncHandler( async (req,res) => {
    // Find user
    // clear cookie -> accessToken and refreshToken 
    // DB remove refreshToken

    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1 // this removes the field from document
            }
        },
        {
            new: true // res new updated value , not old.
        }
    )

    const options ={
        httpOnly: true,
        secure: true
    }

    return res.status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(
        new ApiResponse(200,{},"User logout successfully")
    )
})

const refreshAccessToken = asyncHandler ( async (req,res) => {
    // get refreshToken when fronted hit this end point
    // check refreshToken
    // verify token
    // get user from db
    // check both token -> incomeing and user
    // generate new token and pass in cookies
    const incomeingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomeingRefreshToken){
        throw new ApiError(401, "unauthorized Request")
    }

    try {
        const decodedToken = jwt.verify(
            incomeingRefreshToken, process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decodedToken?._id)
    
        if(!user){
            throw new ApiError(401, "Invalid refresh Token")
        }
    
        if(incomeingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "Refresh Token is expired or used")
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
        const {accessToken , newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
    
        return res.status(200)
        .cookie("accessToken",accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200,
                {accessToken, refreshToken: newRefreshToken},
                "Access token refresh successfully"
            )
        )
    } catch (error) {
        throw new ApiError(401, "Invalid refresh token in catch part" )
    }
})

const changeCurrentPassword = asyncHandler( async (req,res) => {
    const {oldPassword, newPassword} = req.body

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(400, "Invalid old password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res.status(200)
    .json(
        new ApiResponse(
            200,
            {},
            "Password change successfully"
        )
    )

})

const getCurrentUser = asyncHandler( async (req,res) => {
    return res.status(200)
    .json(
        new ApiResponse(
            200,
            req.user,
            "Current user fetched successfully"
        )
    )
})

const updateAccountDetails = asyncHandler ( async (req,res) => {
    const {fullName, email} = req.body
    if(!fullName || !email){
        throw new ApiError(400, "All fields are requird")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email
            }
        },
        {
            new: true
        }
    ).select("-password")

    return res.status(200)
    .json(
        new ApiResponse(
            200,
            user,
            "Account details updated successfully"
        )
    )
})

const updateUserAvatar = asyncHandler ( async (req,res) => {
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400, "Error while uploading avatar")
    }
    
    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {
            new: true
        }
    ).select("-password")

    return res.status(200)
    .json(
        new ApiResponse(
            200,
            user,
            "Avatar updated successfully"
        )
    )
    
})

const updateUserCoverImage = asyncHandler ( async (req,res) => {
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400, "Cover image file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(400, "Error while uploading cover image")
    }
    
    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {
            new: true
        }
    ).select("-password")

    return res.status(200)
    .json(
        new ApiResponse(
            200,
            user,
            "Cover image updated successfully"
        )
    )
    
})

// subscripition join with user model (left join) use aggregation pipeline
const getUserChannelProfile = asyncHandler ( async (req,res) => {
    const {username} = req.params

    if(!username?.trim()){ // hai to optionally trim
        throw new ApiError(400, "Username is missing")
    }

    const channel = await User.aggregate([ // aggregate is method is accept array and further object where object is pipeline
        {
            $match: {
                username: username?.toLowerCase() // kise match karu, give only one user
            }
        },
        {
            $lookup: { 
                from: "subscriptions", // kaha se dekhu (model name) pural value pass
                localField: "_id",
                foreignField: "channel",
                as: "subscribers" // count subscriber through channel
            }
        },
        {
            $lookup: { 
                from: "subscriptions", // kaha se dekhu (model name) pural value pass
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribeTo" // apne kis kis ko subscribed kiya hai subscriber ke through 
            }
        },
        // add to new info in user model
        {
            $addFields: {
                subscriberCount: {
                    $size: { $ifNull: ["$subscribers", []] }, // $ sathe fields name aave
                },
                channelsSubscribedToCount: {
                    $size: { $ifNull: ["$subscribeTO", []] },
                },
                issubscribed: {
                    $cond: { // apply condition if, then(true) and else(false)
                        if: { 
                            $in: [req.user?._id, "$subscribers.subscriber"]//kis object mese dekh na hai. pass model and element // $in: calculate array or object , accept array
                            
                        },
                        then: true,
                            
                        else: false
                    }
                }
            }
        },
        { // give projection, send select items
            $project: {
                fullName: 1,
                username: 1,
                subscriberCount: 1,
                channelsSubscribedToCount: 1,
                issubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ])
    console.log(channel);
    if(!channel?.length){
        throw new ApiError(404, "Channel does not exists")
    }

    return res.status(200)
    .json(
        new ApiResponse(
            200,
            channel,
            "User channel fetched successfully"
        )
    )    
})

const getWatchHistory = asyncHandler ( async (req,res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from : "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
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
                                        avatar: 1,
                                        fullName: 1
                                    }
                                }
                            ]
                        }
                    },
                    { // change data strucure array to object
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res.status(200)
    .json(
        new ApiResponse(
            200,
            user[0].watchHistory,
            "Watch history fected successfully"
        )
    )
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}