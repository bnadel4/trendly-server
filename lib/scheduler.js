'use strict';

const schedule = require('node-schedule');
const smsProfile = require('../model/sms-profile');
const superagent = require('superagent');
const httpErrors = require('http-errors');
const sms = require('../lib/sms');

let eventsNextDay = schedule.scheduleJob('00 00 12 * * *', function(){
  smsProfile.find({})
    .then(allProfiles => {
      const ONE_DAY = 86400000;
      allProfiles.forEach(eachProfile => {
        eachProfile.meetups.forEach(eachMeetupGroup => {
          superagent.get(`https://api.meetup.com/${eachMeetupGroup}/events?key=${process.env.API_KEY}`)
            .then(response => {
              return response.body;
            })
            .then(eventsArray => {
              let aDaysTime = Date.now() + ONE_DAY;
              let filteredEvents = eventsArray.filter(event => {
                return event.time < aDaysTime;
              });
              return filteredEvents.reduce((acc, each) => {
                return `${acc}Hey You have an upcoming event for${each.name}\n${each.group.name}\n${new Date(each.time).toString().match(/\D+ \d+ \d+/)[0]}\n@${each.local_time}\n\n`;
              }, '');
            })
            .then(filteredEvents => {
              if (filteredEvents.length === 0) {
                return;  
              }
              console.log(filteredEvents, eachProfile.phoneNumber);
              sms.sendMessage(filteredEvents, eachProfile.phoneNumber);
              return;
            })
            .catch(console.log);
        });
      });
    })
    .catch(console.log);
});

let updateAllGroups = schedule.scheduleJob('00 00 11 * * *', function(){
  smsProfile.find({})
    .then(allProfiles => {
      allProfiles.forEach(eachProfile => {
        superagent.get(`https://api.meetup.com/groups?member_id=${eachProfile.meetupMemberId}&key=${process.env.API_KEY}`)
          .then(response => {
            return response.body;
          })
          .then(meetupObject => {
            const results = meetupObject.results;
            let groups = [];
            let isTheSame = true;

            results.forEach((eachResult, index) => {
              groups.push(eachResult);
              if (!eachProfile.meetups[index] && eachResult.group_urlname) {
                isTheSame = false;
              }
              if (eachProfile.meetups[index]) {
                if (eachProfile.meetups[index].group_urlname !== eachResult.group_urlname) {
                  isTheSame = false;
                }
              }
            });

            if (isTheSame) {
              return;
            } else {
              smsProfile.findByIdAndUpdate(eachProfile._id, {meetups: groups})
                .then(updatedSmsProfile => {
                  if (!updatedSmsProfile) {
                    throw new httpErrors(404, '__ERROR__ No profile found for the update');
                  }
                  console.log('Account updated');
                })
                .catch(console.log);
            }
          })
          .catch(console.log);
      });
    });
});